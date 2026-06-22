import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

afterEach(cleanup);

const clickButton = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("The Rupee Fund", () => {
  it("renders the home hero by default", () => {
    render(<App />);
    expect(
      screen.getByText("Support Open Source, One Rupee at a Time"),
    ).toBeInTheDocument();
  });

  it("navigates to the Projects screen", () => {
    render(<App />);
    clickButton(/^projects$/i);
    expect(screen.getByText("Supported Projects")).toBeInTheDocument();
  });

  it("navigates to the Manage screen", () => {
    render(<App />);
    clickButton(/^manage$/i);
    expect(screen.getByText("Manage Subscription")).toBeInTheDocument();
  });

  it("navigates to the Subscribe screen from the nav", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    expect(screen.getByText("Start Your Subscription")).toBeInTheDocument();
  });

  it("opens the Subscribe screen from the hero CTA", () => {
    render(<App />);
    clickButton(/start contributing/i);
    expect(screen.getByText("Start Your Subscription")).toBeInTheDocument();
  });

  it("sets the contribution amount from a preset button", () => {
    render(<App />);
    clickButton(/^subscribe$/i);
    clickButton("₹500");
    expect(screen.getByRole("spinbutton")).toHaveValue(500);
  });

  it("mounts every screen without crashing", () => {
    render(<App />);
    for (const screenName of [/^projects$/i, /^manage$/i, /^subscribe$/i, /^home$/i]) {
      clickButton(screenName);
    }
    expect(
      screen.getByText("Support Open Source, One Rupee at a Time"),
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
      screen.getByText(/channels small monthly contributions/i),
    ).toBeInTheDocument();
  });

  it("lists the real FOSS United contact details in the footer", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "foundation@fossunited.org" }),
    ).toHaveAttribute("href", "mailto:foundation@fossunited.org");
    expect(
      screen.getByText(/CIN: U74999MH2016NPL288653/),
    ).toBeInTheDocument();
  });

  it("links About FOSS United to fossunited.org", () => {
    render(<App />);
    expect(
      screen.getByRole("link", { name: "About FOSS United" }),
    ).toHaveAttribute("href", "https://fossunited.org/about");
  });

  it("has dropped the separate FLOSS/fund collaboration section", () => {
    render(<App />);
    expect(screen.queryByText(/FLOSS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Collaborate with/i)).not.toBeInTheDocument();
  });
});
