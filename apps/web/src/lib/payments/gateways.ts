export { myFatoorah, tap, testGateway, GatewayError, type Gateway } from "@sarhad/core";

/** The test gateway marks orders paid with no money: never in production unless asked. */
export function allowTestGateway(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_GATEWAY === "true";
}
