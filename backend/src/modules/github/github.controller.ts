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
    res.status(200).json({
      success: true,
      data: await githubService.startConnection(userId(req), req.body?.returnOrigin, req.body?.returnPath),
    });
  } catch (error) { fail(res, error); }
}

export async function install(req: Request, res: Response) {
  try {
    res.status(200).json({
      success: true,
      data: await githubService.startInstallation(userId(req), req.body?.returnOrigin, req.body?.returnPath),
    });
  } catch (error) { fail(res, error); }
}

export async function callback(req: Request, res: Response) {
  const state = String(req.query.state || "");
  const mode = await githubService.stateMode(state).catch(() => null);
  const hintedUserId = mode
    ? await githubService.userIdForState(state, mode).catch(() => null)
    : null;
  const returnContext = githubService.returnContextForState(state);

  try {
    // GitHub Apps can be configured in two valid ways:
    // 1) OAuth first, then the Setup URL after installation.
    // 2) Request OAuth during installation, which returns to this callback again.
    // Supporting both avoids a permanent "Not connected" state when the app
    // registration uses the second mode.
    if (mode === "installation") {
      const installed = await githubService.completeConnectionAfterInstallation(
        String(req.query.code || ""),
        state,
      );
      res.redirect(await githubService.callbackRedirect(
        installed.userId,
        true,
        undefined,
        "installation",
        installed.returnContext,
      ));
      return;
    }

    const connected = await githubService.completeConnection(String(req.query.code || ""), state);
    if (await githubService.requiresMandatoryInstallation(connected.userId)) {
      const installation = await githubService.startInstallation(
        connected.userId,
        connected.returnContext.returnOrigin,
        connected.returnContext.returnPath,
      );
      res.redirect(installation.installationUrl);
      return;
    }
    res.redirect(await githubService.callbackRedirect(
      connected.userId,
      true,
      undefined,
      "authorization",
      connected.returnContext,
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub connection failed.";
    res.redirect(await githubService.callbackRedirect(
      hintedUserId,
      false,
      message,
      mode === "installation" ? "installation" : "authorization",
      returnContext,
    ));
  }
}

export async function setup(req: Request, res: Response) {
  const state = String(req.query.state || "");
  const hintedUserId = await githubService.userIdForState(state, "installation").catch(() => null);
  const returnContext = githubService.returnContextForState(state);
  try {
    const installed = await githubService.completeInstallation(
      state,
      String(req.query.installation_id || ""),
    );
    res.redirect(await githubService.callbackRedirect(
      installed.userId,
      true,
      undefined,
      "installation",
      installed.returnContext,
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub installation setup failed.";
    res.redirect(await githubService.callbackRedirect(hintedUserId, false, message, "installation", returnContext));
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
