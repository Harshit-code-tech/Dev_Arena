import { prisma } from "../../database/prisma";
import { githubService } from "../github/github.service";
import { PENDING_USERNAME_PREFIX } from "./auth.repository";

export type OnboardingStatus = {
  required: boolean;
  complete: boolean;
  usernameComplete: boolean;
  githubConnected: boolean;
  githubInstallationConfigured: boolean;
};

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const [user, connection, installationCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        usernameChosen: true,
        onboardingRequired: true,
      },
    }),
    prisma.gitHubConnection.findUnique({
      where: { userId },
      select: { accessTokenEncrypted: true },
    }),
    prisma.gitHubInstallationAccess.count({ where: { userId } }),
  ]);

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  const usernameComplete = Boolean(
    user.usernameChosen &&
    user.username &&
    !user.username.startsWith(PENDING_USERNAME_PREFIX),
  );
  const githubConnected = Boolean(connection?.accessTokenEncrypted);
  const githubInstallationConfigured = installationCount > 0;
  const ready = usernameComplete && githubConnected && githubInstallationConfigured;

  return {
    required: user.onboardingRequired,
    complete: !user.onboardingRequired || ready,
    usernameComplete,
    githubConnected,
    githubInstallationConfigured,
  };
}

export async function completeOnboarding(userId: string): Promise<OnboardingStatus> {
  const status = await getOnboardingStatus(userId);

  if (!status.required) {
    return status;
  }

  if (!status.usernameComplete) {
    throw Object.assign(new Error("Choose your permanent DevArena username first."), { statusCode: 409 });
  }

  if (!status.githubConnected) {
    throw Object.assign(new Error("Connect your GitHub account before entering DevArena."), { statusCode: 409 });
  }

  const liveGitHubStatus = await githubService.getStatus(userId);
  if (liveGitHubStatus.accessError) {
    throw Object.assign(new Error(liveGitHubStatus.accessError), { statusCode: 409 });
  }

  if (!liveGitHubStatus.privateRepositoryAccess) {
    throw Object.assign(
      new Error("Grant the DevArena GitHub App access to all repositories or selected repositories, including any private repositories you want to use."),
      { statusCode: 409 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingRequired: false },
  });

  return {
    ...status,
    required: false,
    complete: true,
  };
}
