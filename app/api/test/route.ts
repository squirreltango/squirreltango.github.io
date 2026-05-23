export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ 
    success: true, 
    message: "API working",
    timestamp: new Date().toISOString()
  })
}
