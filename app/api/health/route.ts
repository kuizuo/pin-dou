export function GET() {
  return Response.json({
    ok: true,
    service: "拼豆图纸生成器",
    time: new Date().toISOString(),
  });
}
