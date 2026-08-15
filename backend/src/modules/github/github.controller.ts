import type { Request, Response } from "express";
import { githubService } from "./github.service";

function userId(req: Request) {
  return req.user?.id || "";
}

function fail(res: Response, error: unknown) {
  const status = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode) || 500
    : 500;
  const message = error instanceof Error ? error.message : "GitHub request failed.";
  res.status(status).json({ success: false, message });
}

export async function status(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.getStatus(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function techStack(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.topTechStack(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function rebuildTechStack(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.rebuildTopTechStack(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function connect(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.startConnection(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function install(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.startInstallation(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function callback(req: Request, res: Response) {
  const state = String(req.query.state || "");
  const hintedUserId = await githubService.userIdForState(state, "authorization").catch(() => null);
  try {
    const connectedUserId = await githubService.completeConnection(String(req.query.code || ""), state);
    if (await githubService.requiresMandatoryInstallation(connectedUserId)) {
      // During first-time onboarding, one Connect GitHub action continues into
      // repository selection so selected private repositories are available too.
      const installation = await githubService.startInstallation(connectedUserId);
      res.redirect(installation.installationUrl);
      return;
    }
    res.redirect(await githubService.callbackRedirect(connectedUserId, true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub connection failed.";
    res.redirect(await githubService.callbackRedirect(hintedUserId, false, message));
  }
}

export async function setup(req: Request, res: Response) {
  const state = String(req.query.state || "");
  const hintedUserId = await githubService.userIdForState(state, "installation").catch(() => null);
  try {
    const installedUserId = await githubService.completeInstallation(
      state,
      String(req.query.installation_id || ""),
    );
    res.redirect(await githubService.callbackRedirect(installedUserId, true, undefined, "installation"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub installation setup failed.";
    res.redirect(await githubService.callbackRedirect(hintedUserId, false, message, "installation"));
  }
}

export async function repositories(req: Request, res: Response) {
  try {
    res.status(200).json({ success: true, data: await githubService.listRepositories(userId(req)) });
  } catch (error) { fail(res, error); }
}

export async function verify(req: Request, res: Response) {
  try {
    const verified = await githubService.verifyRepositoryForUser(userId(req), req.body?.repositoryUrl);
    res.status(200).json({ success: true, data: githubService.toClientVerifiedRepository(verified) });
  } catch (error) { fail(res, error); }
}

export async function webhook(req: Request, res: Response) {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !githubService.verifyWebhookSignature(rawBody, req.header("x-hub-signature-256"))) {
      res.status(401).json({ success: false, message: "Invalid GitHub webhook signature." });
      return;
    }
    const event = req.header("x-github-event") || "unknown";
    const deliveryId = req.header("x-github-delivery") || "";
    const result = await githubService.handleWebhook(event, req.body as Record<string, unknown>, deliveryId);
    res.status(202).json({ success: true, data: result });
  } catch (error) { fail(res, error); }
}

export async function disconnect(req: Request, res: Response) {
  try {
    await githubService.disconnect(userId(req));
    res.status(200).json({ success: true, data: { disconnected: true } });
  } catch (error) { fail(res, error); }
}
