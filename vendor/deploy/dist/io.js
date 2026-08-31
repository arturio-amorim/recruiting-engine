const defaultIo = {
    writeStdout: (text) => {
        process.stdout.write(text);
    },
    writeStderr: (text) => {
        process.stderr.write(text);
    },
};
export function createDeployContext(overrides = {}) {
    return {
        cwd: overrides.cwd ?? process.cwd(),
        env: overrides.env ?? process.env,
        io: {
            writeStdout: overrides.io?.writeStdout ?? defaultIo.writeStdout,
            writeStderr: overrides.io?.writeStderr ?? defaultIo.writeStderr,
        },
    };
}
/**
 * Writes one diagnostic to `stderr`. A broken diagnostic destination cannot
 * change the numeric result of a command, so a failing sink is swallowed.
 */
export async function writeDiagnostic(context, text) {
    try {
        await context.io.writeStderr(text);
    }
    catch {
        // Reporting a failure must not become a second failure.
    }
}
//# sourceMappingURL=io.js.map