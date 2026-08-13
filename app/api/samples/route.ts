const NAMES = [
  "sample-cat.svg",
  "docusaurus.png",
  "league_of_legends.png",
  "mcd-lulu.png",
];

export async function GET() {
  return Response.json({
    samples: NAMES.map(name => ({
      name,
      src: `/samples/${encodeURIComponent(name)}`,
    })),
  });
}
