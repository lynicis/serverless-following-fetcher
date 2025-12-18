import Stealth from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-extra";
import { load } from "cheerio";

import {
  FollowingFetcherStrategy,
  FollowingUser,
} from "./followingFetcherFactory";

export class MediumStrategy implements FollowingFetcherStrategy {
  public getFollowings = async (username: string): Promise<FollowingUser[]> => {
    const isLocal = Boolean(process.env.PUPPETEER_CHROMIUM_PATH);
    const executablePath = isLocal
      ? process.env.PUPPETEER_CHROMIUM_PATH
      : await chromium.executablePath();

    const browser = await puppeteer.use(Stealth()).launch({
      args: isLocal ? [] : chromium.args,
      executablePath,
      headless: isLocal ? true : "shell",
    });

    try {
      const page = await browser.newPage();
      const profileUrl = `https://medium.com/@${username}/following`;

      await page.goto(profileUrl, {
        waitUntil: "networkidle2",
        timeout: 20000,
      });

      await this.scrollUntilEnd(page, {
        maxDurationMs: 55000,
        maxScrolls: 1000,
        delayMs: 600,
      });

      const html = await page.content();
      const $ = load(html);

      const followings = new Array<FollowingUser>();
      const path =
        "#root > div > div.m.c > div.ac > div.cd.bi.ce.cf.cg.ch > div > main > div > div > div > div:nth-child(4) > div > ul";
      const profiles = $(path);

      profiles.children().each((_, profile) => {
        const $profile = $(profile);
        const profileUrl = $profile.find("a").attr("href")!;
        const username = this.getUsername(profileUrl);

        if (username === "") return;

        const fullName = $profile.find("h2").text().trim();
        const profilePictureUrl = $profile.find("img").attr("src");

        followings.push({
          profilePictureUrl: profilePictureUrl
            ? this.sanitizeProfilePictureUrl(profilePictureUrl)
            : undefined,
          profileUrl: this.sanitizeProfileUrl(profileUrl),
          fullName,
          username,
        });
      });

      return followings;
    } finally {
      await browser.close();
    }
  };

  private async scrollUntilEnd(
    page: any,
    opts: { maxDurationMs: number; maxScrolls: number; delayMs: number },
  ) {
    const { maxDurationMs, maxScrolls, delayMs } = opts;
    const start = Date.now();
    let previousHeight = await page.evaluate(
      "document.body.scrollHeight || document.documentElement.scrollHeight",
    );

    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(
        "window.scrollTo(0, document.body.scrollHeight || document.documentElement.scrollHeight)",
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const newHeight = await page.evaluate(
        "document.body.scrollHeight || document.documentElement.scrollHeight",
      );

      if (newHeight === previousHeight) {
        break;
      }

      previousHeight = newHeight;

      if (Date.now() - start > maxDurationMs) {
        break;
      }
    }
  }

  public async isUserExists(username: string): Promise<boolean> {
    const response = await fetch(`https://medium.com/feed/@${username}`);
    return response.ok;
  }

  private getUsername(username: string): string {
    const isValidUrl = URL.canParse(username);

    if (isValidUrl) {
      const urlObj = new URL(username);
      const domainSegments = urlObj.username.split(".");

      if (urlObj.host.includes(username) && domainSegments.length === 2) {
        return domainSegments[0];
      }

      const pathSegments = urlObj.pathname.split("/");

      return pathSegments[pathSegments.length - 1];
    }

    return this.extractUsername(username);
  }

  private sanitizeProfileUrl(url: string): string {
    const isValidUrl = URL.canParse(url);

    if (isValidUrl) {
      const urlObj = new URL(url);

      urlObj!.search = "";

      return urlObj.toString();
    }

    const username = this.extractUsername(url);

    return `https://medium.com/@${username}`;
  }

  private sanitizeProfilePictureUrl(url: string): string {
    const urlObj = new URL(url);
    const paths = urlObj.pathname.split("/");

    return new URL(`/v2/${paths[paths.length - 1]}`, urlObj.origin).toString();
  }

  private extractUsername(username: string): string {
    const match = username.match(/@([a-zA-Z0-9_-]+)/);

    return match ? match[1] : username;
  }
}
