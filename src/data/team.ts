export interface TeamMember {
  readonly name: string;
  readonly role: string;
}

export const FOUNDING_TEAM: readonly TeamMember[] = [
  { name: "Shree Kumar", role: "Founder · Website maintainer" },
  { name: "Mrugesh Mohapatra", role: "Founder · Website maintainer" },
  { name: "Khitab", role: "Founder · Website maintainer" },
];

export const FOSS_UNITED_STAFF: readonly TeamMember[] = [
  { name: "Ansh Arora", role: "Program & Partnerships Manager" },
  { name: "Ashlesh B", role: "Campaigns & Advocacy Manager" },
  { name: "Dilip G", role: "Software Engineer" },
  { name: "Jeswin Jose", role: "Graphic Designer" },
  { name: "Ruchika Bagde", role: "Diversity and Operations Manager" },
  { name: "Siddharth Shivkumar", role: "Learner Programs" },
  { name: "Vrinda Gandhi", role: "Program Associate" },
];
