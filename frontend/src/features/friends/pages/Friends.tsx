import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { toast } from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriendOverview,
  inviteFriendByEmail,
  removeFriend,
  searchDevelopers,
  sendFriendRequest,
  type FriendOverview,
  type FriendPerson,
  type FriendSearchResult,
} from "../../../services/FriendsService";
import "../styles/Friends.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "DA";
}

function relationshipLabel(relationship: FriendSearchResult["relationship"]) {
  if (relationship === "friends") return "Connected";
  if (relationship === "incoming") return "Respond below";
  if (relationship === "outgoing") return "Request sent";
  return "Add player";
}

export default function Players() {
  const [overview, setOverview] = useState<FriendOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendFilter, setFriendFilter] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    if (!overview) return [];
    const query = friendFilter.trim().toLowerCase();
    if (!query) return overview.friends;
    return overview.friends.filter(({ friend }) =>
      [friend.name, friend.email || "", friend.username].some((value) => value.toLowerCase().includes(query)),
    );
  }, [friendFilter, overview]);

  const reload = useCallback(async () => {
    const data = await getFriendOverview();
    setOverview(data);
  }, []);

  useEffect(() => {
    void reload()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Players could not be loaded."))
      .finally(() => setLoading(false));

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload().catch(() => undefined);
    }, 30000);
    const refreshOnFocus = () => void reload().catch(() => undefined);

    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [reload]);

  useEffect(() => {
    const refreshPlayers = () => {
      void reload().catch(() => undefined);
      void searchDevelopers(searchQuery.trim()).then(setSearchResults).catch(() => undefined);
    };
    window.addEventListener("devarena:players-refresh", refreshPlayers);
    return () => window.removeEventListener("devarena:players-refresh", refreshPlayers);
  }, [reload, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchDevelopers(query)
        .then((results) => {
          if (active) setSearchResults(results);
        })
        .catch((error) => {
          if (active) toast.error(error instanceof Error ? error.message : "Player search failed.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, query ? 260 : 40);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  if (loading || !overview) return <PageLoader variant="players" />;

  async function runAction(id: string, action: () => Promise<unknown>, success: string) {
    try {
      setWorkingId(id);
      await action();
      await reload();
      searchDevelopers(searchQuery.trim()).then(setSearchResults).catch(() => undefined);
      window.dispatchEvent(new Event("devarena:notifications-refresh"));
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setWorkingId(null);
    }
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    try {
      setWorkingId("invite");
      const result = await inviteFriendByEmail(email);
      setInviteEmail("");
      await reload();
      window.dispatchEvent(new Event("devarena:notifications-refresh"));
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invitation could not be sent.");
    } finally {
      setWorkingId(null);
    }
  }

  async function handleRemove(friendId: string) {
    if (confirmRemove !== friendId) {
      setConfirmRemove(friendId);
      return;
    }
    await runAction(`remove-${friendId}`, () => removeFriend(friendId), "Player removed.");
    setConfirmRemove(null);
  }

  return (
    <main className="friends-page animated-page">
      <header className="friends-hero page-reveal">
        <div>
          <p className="friends-eyebrow">Developer network</p>
          <h1>Players</h1>
        </div>
        <p>Invite players, search the global community, manage requests, and keep your trusted network in one place.</p>
      </header>

      <section className="friends-command-grid page-reveal" style={{ "--reveal-order": 1 } as CSSProperties}>
        <article className="friends-command-card invite-card">
          <div className="friends-section-heading">
            <div><p>01 / Email invitations</p><h2>Invite by email</h2></div>
            <span>{overview.emailInvites.length} pending</span>
          </div>
          <p>Registered emails receive a player request. New players receive a secure signup invitation.</p>
          <form onSubmit={sendInvite}>
            <label className="friends-line-field"><span>Email address</span><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder=" " aria-label="Email address" /></label>
            <ActionButton type="submit" loading={workingId === "invite"} disabled={!inviteEmail.trim()}>Send invite</ActionButton>
          </form>
          <div className="pending-email-stage" aria-live="polite">
            {overview.emailInvites.length > 0 ? (
              <div className="pending-email-list">
                {overview.emailInvites.slice(0, 10).map((invite) => (
                  <div key={invite.id}><span>{invite.email}</span><small>Expires <LiveDateTime value={invite.expiresAt} mode="relative" /></small></div>
                ))}
              </div>
            ) : (
              <div className="friends-empty pending-email-empty">No pending email invitations.</div>
            )}
          </div>
        </article>

        <article className="friends-command-card search-card">
          <div className="friends-section-heading"><div><p>02 / Global search</p><h2>Find players</h2></div><span>{searchResults.length} results</span></div>
          <label className="friends-line-field"><span>Name, @username, or email</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder=" " aria-label="Name, username, or email" /></label>
          <div className="global-search-results" aria-live="polite">
            {searching && <div className="friends-inline-loader"><span /> Loading players…</div>}
            {!searching && searchResults.length === 0 && <div className="friends-empty">No matching players found.</div>}
            {searchResults.map((result) => (
              <article className="developer-result" key={result.id}>
                <Person person={result} showTechStack />
                <ActionButton
                  disabled={result.relationship !== "none" || workingId === `search-${result.id}`}
                  loading={workingId === `search-${result.id}`}
                  onClick={() => void runAction(`search-${result.id}`, () => sendFriendRequest(result.id), "Player request sent.")}
                >
                  {relationshipLabel(result.relationship)}
                </ActionButton>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="request-grid page-reveal" style={{ "--reveal-order": 2 } as CSSProperties}>
        <article className="request-panel">
          <div className="friends-section-heading"><div><p>03 / Incoming</p><h2>Requests to you</h2></div><span>{overview.incomingRequests.length}</span></div>
          <div className="request-list">
            {overview.incomingRequests.map((request) => (
              <article className="request-row" key={request.id}>
                <Person person={request.user} compact />
                <div className="request-actions">
                  <ActionButton loading={workingId === `accept-${request.id}`} onClick={() => void runAction(`accept-${request.id}`, () => acceptFriendRequest(request.id), "Player request accepted.")}>Accept</ActionButton>
                  <ActionButton danger loading={workingId === `decline-${request.id}`} onClick={() => void runAction(`decline-${request.id}`, () => declineFriendRequest(request.id), "Player request declined.")}>Decline</ActionButton>
                </div>
              </article>
            ))}
            {overview.incomingRequests.length === 0 && <div className="friends-empty">No incoming requests.</div>}
          </div>
        </article>

        <article className="request-panel">
          <div className="friends-section-heading"><div><p>04 / Outgoing</p><h2>Requests you sent</h2></div><span>{overview.outgoingRequests.length}</span></div>
          <div className="request-list">
            {overview.outgoingRequests.map((request) => (
              <article className="request-row" key={request.id}>
                <Person person={request.user} compact />
                <ActionButton danger loading={workingId === `cancel-${request.id}`} onClick={() => void runAction(`cancel-${request.id}`, () => cancelFriendRequest(request.id), "Player request cancelled.")}>Cancel</ActionButton>
              </article>
            ))}
            {overview.outgoingRequests.length === 0 && <div className="friends-empty">No outgoing requests.</div>}
          </div>
        </article>
      </section>

      <section className="friends-list-panel page-reveal" style={{ "--reveal-order": 3 } as CSSProperties}>
        <div className="friends-list-header">
          <div><p className="friends-eyebrow">05 / Trusted network</p><h2>Your players</h2></div>
          <label className="friends-line-field"><span>Filter players</span><input value={friendFilter} onChange={(event) => setFriendFilter(event.target.value)} placeholder=" " aria-label="Filter players" /></label>
        </div>
        <div className="friends-directory">
          {filteredFriends.map(({ friend, friendsSince }) => (
            <article className="friend-directory-row" key={friend.id}>
              <Person person={friend} />
              <div className="friend-meta"><strong>{friend.rank}</strong><span>{friend.arenaScore} Arena Score</span><small>Connected <LiveDateTime value={friendsSince} mode="relative" /></small></div>
              <ActionButton danger loading={workingId === `remove-${friend.id}`} onClick={() => void handleRemove(friend.id)}>{confirmRemove === friend.id ? "Confirm remove" : "Remove"}</ActionButton>
            </article>
          ))}
          {filteredFriends.length === 0 && <div className="friends-empty friends-empty-large">No players match this search yet.</div>}
        </div>
      </section>
    </main>
  );
}

function Person({ person, compact = false, showTechStack = false }: { person: FriendPerson; compact?: boolean; showTechStack?: boolean }) {
  return (
    <div className={`friend-person${compact ? " compact" : ""}`}>
      <div className="friend-avatar">{person.avatarUrl && !person.useInitials ? <img src={person.avatarUrl} alt="" /> : <span>{initials(person.name)}</span>}</div>
      <div className="friend-person-copy">
        <h3>{person.name}</h3>
        <p>@{person.username}</p>
        {!compact && !showTechStack && person.email && <span>{person.email}</span>}
        {showTechStack && (
          <div className="player-tech-stack" aria-label="Live Top Tech Stack">
            {(person.topTechStack || []).length > 0
              ? (person.topTechStack || []).slice(0, 3).map((technology) => <span key={technology.name}>{technology.name}</span>)
              : <span>No verified project technologies</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, loading, danger, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; danger?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} className={`friend-action${danger ? " danger" : ""}`} onClick={onClick} disabled={disabled || loading}>
      {loading ? <span className="friend-button-loader" aria-label="Working" /> : children}
    </button>
  );
}
