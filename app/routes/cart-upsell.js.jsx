import { readFileSync } from "fs";
import { join } from "path";

export const loader = () => {
  const js = readFileSync(join(process.cwd(), "public/cart-upsell.js"), "utf-8");
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
