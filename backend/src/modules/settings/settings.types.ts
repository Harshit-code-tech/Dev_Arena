export type SettingsPreferencesInput = Partial<{
  useInitials: boolean;
  activityReminders: boolean;
  privacyMode: boolean;
  compactWorkspace: boolean;
  friendRequestEmails: boolean;
  loginOtpEmails: boolean;
  streakReminderEmails: boolean;
  challengeNotifications: boolean;
  inAppNotifications: boolean;
}>;

export type IdentityChangeInput = {
  name?: string;
  email?: string;
};

export type ProfilePhotoInput = {
  imageData?: string;
  imageUrl?: string;
};
