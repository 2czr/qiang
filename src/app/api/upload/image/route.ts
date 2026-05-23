import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";
import { getUserFromRequest } from "@/lib/auth";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: process.env.COZE_BUCKET_ACCESS_KEY || "",
  secretKey: process.env.COZE_BUCKET_SECRET_KEY || "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择图片" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "仅支持 JPG/PNG/GIF/WebP 格式" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "图片大小不能超过5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `chat-images/${user.id}_${Date.now()}.${ext}`;

    const fileKey = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: file.type,
    });

    const imageUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 30, // 30 days
    });

    return NextResponse.json({ url: imageUrl, fileKey });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json({ error: "图片上传失败" }, { status: 500 });
  }
}
