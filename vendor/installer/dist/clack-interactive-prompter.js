import { autocomplete, cancel, confirm, intro, isCancel, log, multiselect, note, outro, select, spinner, } from "@clack/prompts";
function submitted(value) {
    return { kind: "submitted", value };
}
function cancelled() {
    return { kind: "cancelled" };
}
function options(values) {
    return values.map((option) => ({
        value: option.value,
        label: option.label,
        ...(option.hint === undefined ? {} : { hint: option.hint }),
        ...(option.disabled === undefined ? {} : { disabled: option.disabled }),
    }));
}
async function autocompletePrompt(prompt) {
    const value = await autocomplete({
        message: prompt.message,
        options: options(prompt.options),
        ...(prompt.maxItems === undefined ? {} : { maxItems: prompt.maxItems }),
        ...(prompt.placeholder === undefined
            ? {}
            : { placeholder: prompt.placeholder }),
        ...(prompt.initialValue === undefined
            ? {}
            : { initialValue: prompt.initialValue }),
    });
    if (isCancel(value))
        return cancelled();
    return submitted(value);
}
async function selectPrompt(prompt) {
    const value = await select({
        message: prompt.message,
        options: options(prompt.options),
        ...(prompt.maxItems === undefined ? {} : { maxItems: prompt.maxItems }),
        ...(prompt.initialValue === undefined
            ? {}
            : { initialValue: prompt.initialValue }),
    });
    if (isCancel(value))
        return cancelled();
    return submitted(value);
}
async function multiselectPrompt(prompt) {
    const value = await multiselect({
        message: prompt.message,
        options: options(prompt.options),
        required: true,
        ...(prompt.maxItems === undefined ? {} : { maxItems: prompt.maxItems }),
        ...(prompt.initialValues === undefined
            ? {}
            : { initialValues: [...prompt.initialValues] }),
    });
    if (isCancel(value))
        return cancelled();
    return submitted(value);
}
async function confirmPrompt(message) {
    const value = await confirm({ message, initialValue: false });
    if (isCancel(value))
        return cancelled();
    return submitted(value);
}
export function createClackInteractivePrompter() {
    return {
        intro,
        outro,
        cancel,
        autocomplete: autocompletePrompt,
        select: selectPrompt,
        multiselect: multiselectPrompt,
        note,
        confirm: confirmPrompt,
        spinner: () => {
            const instance = spinner();
            return {
                start: (message) => instance.start(message),
                stop: (message) => instance.stop(message),
                cancel: (message) => instance.cancel(message),
                error: (message) => instance.error(message),
                message: (message) => instance.message(message),
                clear: () => instance.clear(),
            };
        },
        log: (level, message) => log[level](message),
    };
}
//# sourceMappingURL=clack-interactive-prompter.js.map