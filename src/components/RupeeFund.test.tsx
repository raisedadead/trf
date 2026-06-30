import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

afterEach(cleanup);

const clickButton = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const HERO_HEADLINE = "Keep Indian open source alive — one rupee at a time";

describe("The Rupee Fund", () => {
  it("renders the home hero by default", () => {
    render(<App />);
    expect(screen.getByText(HERO_HEADLINE)).toBeInTheDocument();
  });

  it("navigates to the Projects screen", () => {
    render(<App />);
    clickButton(/^projects$/i);
    expect(screen.getByText("Where your rupees will go")).toBeInTheDocument();
  });

  it("navigates to the Manage screen", () => {
    render(<App />);
    clickButton(/^manage$/i);
    expect(screen.getByText("Manage Subscription")).toBeInTheDocument();
  });

  it("navigates to the Subscribe screen from the nav", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    expect(
      screen.getByText("Become a Founding Contributor"),
    ).toBeInTheDocument();
  });

  it("opens the Subscribe screen from the hero CTA", () => {
    render(<App />);
    clickButton(/become a founding contributor/i);
    expect(
      screen.getByText("Become a Founding Contributor"),
    ).toBeInTheDocument();
  });

  it("sets the contribution amount from a preset button in AutoPay mode", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    clickButton(/set up autopay now/i);
    clickButton("₹500");
    expect(screen.getByRole("spinbutton")).toHaveValue(500);
  });

  it("mounts every screen without crashing", () => {
    render(<App />);
    for (const screenName of [
      /^projects$/i,
      /^manage$/i,
      /^subscribe$/i,
      /^home$/i,
    ]) {
      clickButton(screenName);
    }
    expect(screen.getByText(HERO_HEADLINE)).toBeInTheDocument();
  });
});

describe("The Rupee Fund — pre-launch honesty", () => {
  it("frames Projects as pre-launch with no disbursements", () => {
    render(<App />);
    clickButton(/^projects$/i);
    expect(screen.getByText(/No disbursements yet/i)).toBeInTheDocument();
  });

  it("frames Manage as a preview with no active subscription", () => {
    render(<App />);
    clickButton(/^manage$/i);
    expect(screen.getByText(/No active subscription yet/i)).toBeInTheDocument();
  });

  it("attributes credibility stats to FOSS United via the heading", () => {
    render(<App />);
    expect(
      screen.getByText(/what FOSS United has funded/i),
    ).toBeInTheDocument();
    expect(screen.getByText("₹3cr+")).toBeInTheDocument();
  });
});

describe("The Rupee Fund — dual subscribe path", () => {
  it("defaults to the waitlist path with no payment", () => {
    render(<App />);
    clickButton(/notify me at launch/i);
    expect(
      screen.getByRole("button", { name: /join the waitlist/i }),
    ).toBeInTheDocument();
  });

  it("switches to the early-bird AutoPay path", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    clickButton(/set up autopay now/i);
    expect(
      screen.getByRole("button", { name: /set up upi autopay/i }),
    ).toBeInTheDocument();
  });
});

describe("The Rupee Fund — branding & content", () => {
  it("shows the FOSS United lockup logo in the header", () => {
    render(<App />);
    expect(
      screen.getByAltText("The Rupee Fund by FOSS United"),
    ).toBeInTheDocument();
  });

  it("no longer shows the old FOSS Fund wordmark", () => {
    render(<App />);
    expect(screen.queryByText("FOSS Fund")).not.toBeInTheDocument();
  });

  it("states the indie-maintainer scope in the hero", () => {
    render(<App />);
    expect(
      screen.getByText(/pools small monthly UPI\s+contributions/i),
    ).toBeInTheDocument();
  });

  it("lists the real FOSS United contact details in the footer", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "foundation@fossunited.org" }),
    ).toHaveAttribute("href", "mailto:foundation@fossunited.org");
    expect(screen.getByText(/CIN: U74999MH2016NPL288653/)).toBeInTheDocument();
  });

  it("links About FOSS United to fossunited.org", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "About FOSS United" }),
    ).toHaveAttribute("href", "https://fossunited.org/about");
  });
});
