const ollamaName = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*(?::[a-z0-9][a-z0-9._-]*)?$/i;

export const validOllamaName = value => typeof value === 'string' && value.length <= 200 && ollamaName.test(value);
export const isCloudOllamaName = value => /(?:-|:)cloud(?::latest)?$/i.test(value.split('/').at(-1));

const refSegment = '[a-z0-9][a-z0-9._-]*';
const lmStudioCatalogId = new RegExp(`^${refSegment}(?:/${refSegment})?$`, 'i');
const lmStudioHuggingFaceRepo = new RegExp(`^https://huggingface\\.co/${refSegment}/${refSegment}/?$`, 'i');

export const isHuggingFaceRepo = value => typeof value === 'string' && lmStudioHuggingFaceRepo.test(value);
export const validLMStudioModel = value => typeof value === 'string' && value.length <= 250 && (lmStudioCatalogId.test(value) || isHuggingFaceRepo(value));
export const validLMStudioQuantization = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(value);
