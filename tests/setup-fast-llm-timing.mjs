// Fake providers answer in milliseconds; the real 1s spacing between LLM request starts would only slow tests.
// Tests that check the spacing set their own interval on the controller.
import { llmRequestTiming } from "../extension/shared/translation.js";

llmRequestTiming.minIntervalMs = 0;
