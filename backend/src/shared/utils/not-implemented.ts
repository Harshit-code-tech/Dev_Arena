import type { NotImplementedResponse } from "../types/not-implemented";

export function notImplemented(): NotImplementedResponse {
    return { message: "Not implemented yet" };
}
