import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

afterEach(cleanup);

const clickButton = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const HERO_HEADLINE = "Keep Indian open source alive — one rupee at a time";

describe("The Rupee Fund — navigation", () => {
  it("renders the home hero by default", () => {
    render(<App />);
    expect(screen.getByText(HERO_HEADLINE)).toBeInTheDocument();
  });

  it("routes to each screen from the nav", () => {
    render(<App />);
    const routes: Array<[RegExp, string]> = [
      [/^projects$/i, "Where your rupees will go"],
      [/^manage$/i, "Manage Subscription"],
      [/^subscribe$/i, "Become a Founding Contributor"],
    ];
    for (const [nav, heading] of routes) {
      clickButton(nav);
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it("opens Subscribe from the hero CTA", () => {
    render(<App />);
    clickButton(/become a founding contributor/i);
    expect(
      screen.getByText("Become a Founding Contributor"),
    ).toBeInTheDocument();
  });
});

describe("The Rupee Fund — subscribe flow", () => {
  it("toggles between the waitlist and AutoPay paths", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    clickButton(/notify me at launch/i);
    expect(
      screen.getByRole("button", { name: /join the waitlist/i }),
    ).toBeInTheDocument();
    clickButton(/set up autopay now/i);
    expect(
      screen.getByRole("button", { name: /set up upi autopay/i }),
    ).toBeInTheDocument();
  });

  it("sets the contribution amount from a preset", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    clickButton("₹500");
    expect(screen.getByRole("spinbutton")).toHaveValue(500);
  });
});

describe("The Rupee Fund — pre-launch honesty", () => {
  it("shows no disbursements on the Projects screen", () => {
    render(<App />);
    clickButton(/^projects$/i);
    expect(screen.getByText(/No disbursements yet/i)).toBeInTheDocument();
  });

  it("shows no active subscription on the Manage screen", () => {
    render(<App />);
    clickButton(/^manage$/i);
    expect(screen.getByText(/No active subscription yet/i)).toBeInTheDocument();
  });
});

describe("The Rupee Fund — attribution & compliance", () => {
  it("links the credibility stats to the FOSS United grants page", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: /what FOSS United has funded/i }),
    ).toHaveAttribute("href", "https://fossunited.org/grants");
  });

  it("links the Privacy, Terms and Refund policies in the footer", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "https://fossunited.org/privacy-policy");
    expect(
      screen.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "https://fossunited.org/terms-of-service");
    expect(screen.getByRole("link", { name: "Refund Policy" })).toHaveAttribute(
      "href",
      "https://fossunited.org/refund-transfer-policy",
    );
  });
});
