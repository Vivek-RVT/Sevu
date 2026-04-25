export type PlanId = "starter" | "growth" | "pro";

export interface PlanInfo {
  id: PlanId;
  name: string;
  priceRegular: number;
  priceLaunch: number;
  maxPosts: number;
  popular?: boolean;
  sections: {
    title: string;
    items: { label: string; included: boolean }[];
  }[];
}

export const PLANS: PlanInfo[] = [
  {
    id: "starter",
    name: "Starter",
    priceRegular: 99,
    priceLaunch: 49,
    maxPosts: 10,
    sections: [
      {
        title: "Core App",
        items: [
          { label: "Customer management", included: true },
          { label: "Service logging", included: true },
          { label: "Payment due tracker", included: true },
          { label: "In-app reminders", included: true },
        ],
      },
      {
        title: "Profile",
        items: [
          { label: "Basic Sevu profile listing", included: true },
          { label: "Public profile link", included: true },
          { label: "SEO-optimized profile", included: false },
          { label: "Review collection", included: false },
        ],
      },
      {
        title: "Posts & Export",
        items: [
          { label: "10 posts max", included: true },
          { label: "Service log export", included: false },
        ],
      },
      {
        title: "WhatsApp",
        items: [
          { label: "No WhatsApp alerts", included: false },
        ],
      },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceRegular: 199,
    priceLaunch: 99,
    maxPosts: 15,
    popular: true,
    sections: [
      {
        title: "Core App",
        items: [
          { label: "Everything in Starter", included: true },
        ],
      },
      {
        title: "Profile",
        items: [
          { label: "SEO-optimized profile", included: true },
          { label: "Review collection link", included: true },
          { label: "Full analytics dashboard", included: true },
          { label: "Digital visiting card link", included: true },
        ],
      },
      {
        title: "Posts & Export",
        items: [
          { label: "15 posts max", included: true },
          { label: "Service log export", included: false },
        ],
      },
      {
        title: "WhatsApp",
        items: [
          { label: "30 reminders/month", included: true },
          { label: "Due payment alerts", included: true },
        ],
      },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceRegular: 299,
    priceLaunch: 149,
    maxPosts: 20,
    sections: [
      {
        title: "Core App",
        items: [
          { label: "Everything in Growth", included: true },
        ],
      },
      {
        title: "Profile",
        items: [
          { label: "Verified Pro badge", included: true },
          { label: "Priority listing in search", included: true },
          { label: "Near Me discovery boost", included: true },
        ],
      },
      {
        title: "Posts & Export",
        items: [
          { label: "20 posts max", included: true },
          { label: "Service log PDF export", included: true },
        ],
      },
      {
        title: "WhatsApp",
        items: [
          { label: "100 reminders/month", included: true },
          { label: "Due payment alerts", included: true },
          { label: "Service follow-up messages", included: true },
        ],
      },
    ],
  },
];

export function getPlan(id: string | null | undefined): PlanInfo {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function maxPostsForPlan(id: string | null | undefined): number {
  return getPlan(id).maxPosts;
}
