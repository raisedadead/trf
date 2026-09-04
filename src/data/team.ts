export interface TeamMember {
  readonly name: string;
  readonly bio?: string;
  readonly profileUrl?: string;
  readonly username?: string;
  readonly photoUrl?: string;
  readonly hidden?: boolean;
}

export const COMMUNITY_TEAM: readonly TeamMember[] = [
  {
    name: "Shree Kumar",
    bio: "Shree (Kumar) is an active volunteer at FOSS United and an elected member of its Governance Board.",
    profileUrl: "https://fossunited.org/u/shreekumar3d",
    username: "shreekumar3d",
    photoUrl: "/team/shree.jpg",
  },
  {
    name: "Mrugesh Mohapatra",
    bio: "Mrugesh is an active member of the FOSS United community and organises meetups for the Agentic AI Foundation's Bengaluru Chapter.",
    profileUrl: "https://fossunited.org/u/mrugesh",
    username: "mrugesh",
    photoUrl: "/team/mrugesh.png",
  },
  { name: "Khitab", hidden: true },
];
