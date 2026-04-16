export async function onRequest(context) {
  const { request, env } = context;
  
  // 无论 GET 还是 POST，都执行查询逻辑
  const apiKey = env.NOTION_API_KEY;
  const databaseId = env.NOTION_DATABASE_ID;
  const notionVersion = "2022-06-28";

  if (!apiKey || !databaseId) {
    return new Response(JSON.stringify({ 
      error: "环境变量缺失", 
      details: "请在 CF 控制台检查 NOTION_API_KEY 和 NOTION_DATABASE_ID 是否配置并已重新部署" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const apiUrl = `https://api.notion.com/v1/databases/${databaseId}/query`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST", // 向 Notion 发送请求始终用 POST
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Notion-Version": notionVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "sorts": [{ "property": "排序", "direction": "ascending" }]
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
