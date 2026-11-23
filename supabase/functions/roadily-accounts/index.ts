import { makeHandler } from "./handler.mjs";

const expectedProject = "https://asazccxbrlflreeamokl.supabase.co";
const project = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (project !== expectedProject || !key) throw new Error("Dedicated Roadily project is required");
const rpc = async (op: string,data: unknown) => {
  const result = await fetch(project + "/rest/v1/rpc/roadily_private_api", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({p_op:op,p_data:data}),
    signal: AbortSignal.timeout(8000)
  });
  if(!result.ok)throw new Error("Roadily database operation failed");
  return await result.json();
};
Deno.serve(makeHandler({rpc}));
