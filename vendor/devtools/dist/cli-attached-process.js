import { ATTACHED_CLI_SESSION_LIMITS, attachedCliError, AttachedCliSessionError, } from "./cli-attached-contract.js";
export const attachedCliDeadlineReason = Object.freeze({
    type: "attached-cli-deadline",
});
function killChild(child, clock, graceMs) {
    if (child.exitCode !== null || child.signalCode !== null)
        return;
    child.kill("SIGTERM");
    const handle = clock.schedule(() => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
        }
    }, graceMs);
    child.once("exit", () => {
        clock.cancel(handle);
    });
}
export function collectAttachedCliChild(spawn, target, verbArgs, env, clock, killGraceMs, signal) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let overflow = false;
        let child;
        try {
            child = spawn(target.command, [...target.args, ...verbArgs], {
                ...(target.cwd === undefined ? {} : { cwd: target.cwd }),
                env,
                shell: false,
                stdio: ["ignore", "pipe", "pipe"],
            });
        }
        catch (cause) {
            reject(attachedCliError("SPAWN_FAILED", cause));
            return;
        }
        const stdoutChunks = [];
        const stderrChunks = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        const finish = (error, result) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener("abort", onAbort);
            if (error !== undefined)
                reject(error);
            else if (result !== undefined)
                resolve(result);
        };
        const onAbort = () => {
            killChild(child, clock, killGraceMs);
        };
        const onChunk = (stream, value) => {
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            if (stream === "stdout") {
                if (stdoutBytes + chunk.length >
                    ATTACHED_CLI_SESSION_LIMITS.streamBytes) {
                    overflow = true;
                    killChild(child, clock, killGraceMs);
                    return;
                }
                stdoutChunks.push(chunk);
                stdoutBytes += chunk.length;
                return;
            }
            if (stderrBytes + chunk.length >
                ATTACHED_CLI_SESSION_LIMITS.streamBytes) {
                overflow = true;
                killChild(child, clock, killGraceMs);
                return;
            }
            stderrChunks.push(chunk);
            stderrBytes += chunk.length;
        };
        child.stdout?.on("data", (chunk) => {
            onChunk("stdout", chunk);
        });
        child.stderr?.on("data", (chunk) => {
            onChunk("stderr", chunk);
        });
        child.once("error", (cause) => {
            finish(attachedCliError("SPAWN_FAILED", cause));
        });
        // `close` rather than `exit`: the child is gone on `exit`, but its stdio
        // pipes may still hold undelivered bytes, which truncates a catalog large
        // enough to arrive in more than one chunk.
        child.once("close", (code) => {
            if (overflow) {
                finish(attachedCliError("LIMIT_EXCEEDED"));
                return;
            }
            if (signal.aborted) {
                finish(attachedCliError(signal.reason === attachedCliDeadlineReason
                    ? "TIMEOUT"
                    : "NOT_CONNECTED"));
                return;
            }
            finish(undefined, {
                exitCode: code,
                stdout: Buffer.concat(stdoutChunks),
                stderr: Buffer.concat(stderrChunks),
            });
        });
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted)
            onAbort();
    });
}
export function runAttachedCliWithDeadline(clock, timeoutMs, controller, operation) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let handle;
        const cleanup = () => {
            clock.cancel(handle);
            controller.signal.removeEventListener("abort", onAbort);
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const onAbort = () => {
            fail(attachedCliError(controller.signal.reason === attachedCliDeadlineReason
                ? "TIMEOUT"
                : "NOT_CONNECTED"));
        };
        controller.signal.addEventListener("abort", onAbort, { once: true });
        handle = clock.schedule(() => {
            if (settled)
                return;
            settled = true;
            cleanup();
            controller.abort(attachedCliDeadlineReason);
            reject(attachedCliError("TIMEOUT"));
        }, timeoutMs);
        let pending;
        try {
            pending = operation(controller.signal);
        }
        catch (cause) {
            fail(cause instanceof AttachedCliSessionError
                ? cause
                : attachedCliError("SPAWN_FAILED", cause));
            return;
        }
        void pending.then((value) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(value);
        }, (cause) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(cause instanceof AttachedCliSessionError
                ? cause
                : attachedCliError("CONNECTION_FAILED", cause));
        });
    });
}
//# sourceMappingURL=cli-attached-process.js.map