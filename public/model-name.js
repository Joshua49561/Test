const ollamaName = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*(?::[a-z0-9][a-z0-9._-]*)?$/i;

export const validOllamaName = value => typeof value === 'string' && value.length <= 200 && ollamaName.test(value);
export const isCloudOllamaName = value => /(?:-|:)cloud(?::latest)?$/i.test(value.split('/').at(-1));
