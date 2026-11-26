const stripeKey = "sk_live_DemoLeakKey1234567890abcdef";
export function charge() { return stripeKey; }

const stripeKey = "sk_live_DemoLeakKey1234567890abcdef";
const awsSecret = "AKIAIOSFODNN7EXAMPLE";
export function charge() { return { stripeKey, awsSecret }; }
