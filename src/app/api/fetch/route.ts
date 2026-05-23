import { NextRequest, NextResponse } from "next/server";
import { FetchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "缺少URL" }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    // Extract images from the page
    const images = response.content
      .filter(item => item.type === "image" && item.image?.display_url)
      .map(item => ({
        url: item.image?.display_url || "",
        original_url: item.image?.image_url || "",
        width: item.image?.width,
        height: item.image?.height,
      }));

    return NextResponse.json({
      title: response.title,
      images,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
