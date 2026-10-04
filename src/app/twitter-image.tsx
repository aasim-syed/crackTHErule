import { ogCard, OG_SIZE } from "@/lib/og-card";

export const alt = "Crack the Rule: six switches, one door, a secret rule. Race an AI to crack it.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogCard({
    eyebrow: "Six switches · one door · you vs AI",
    title: "Can you outsmart an AI?",
    subtitle: "A secret rule opens the door. Crack it in fewer tries than the machine.",
  });
}
