import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../auth/context/AuthContext";
import { sendFriendRequest } from "../../../services/FriendsService";
import {
  PlayerHubApi,
  PlayerHubRequestError,
  type BlockedPlayer,
  type CollaborationApplication,
  type CollaborationPost,
  type CommunityPost,
  type DirectConversation,
  type EncryptedDirectMessage,
  type HubOverview,
  type HubPerson,
  type HubPlayer,
  type MatchingEligibility,
  type MatchingPreference,
  type PlayerMatchRecommendation,
  type SharedProject,
} from "../../../services/PlayerHubService";
import {
  decryptDirectMessage,
  encryptDirectMessage,
  ensureChatIdentity,
  ChatIdentityActionError,
  type ChatIdentity,
  type ChatIdentityAction,
} from "../../../services/PlayerHubCryptoService";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import AnimatedSelect, { type AnimatedSelectOption } from "../../../shared/components/AnimatedSelect";
import { OfflineMessageQueue, type QueuedEncryptedMessage } from "../../../services/OfflineMessageQueueService";
import SecureChatRecoveryPanel from "../components/SecureChatRecoveryPanel";
import "../styles/PlayerHub.css";

type HubSection =
  | "discover"
  | "projects"
  | "collaboration"
  | "community"
  | "messages"
  | "safety"
  | "matching"
  | "profiles";

type ModalState =
  | { type: "player"; player: HubPlayer }
  | { type: "project"; project: SharedProject }
  | { type: "create-collaboration" }
  | { type: "apply"; post: CollaborationPost }
  | { type: "applications"; post: CollaborationPost }
  | { type: "create-community" }
  | { type: "comments"; post: CommunityPost }
  | { type: "report"; subjectType: string; subjectId: string; subject: string }
  | null;

const SECTION_META: Array<{ id: HubSection; label: string; kicker: string; icon: string }> = [
  { id: "discover", label: "Discover Players", kicker: "Live player directory", icon: "bx-radar" },
  { id: "projects", label: "Shared Projects", kicker: "Public proof of work", icon: "bx-folder-open" },
  { id: "collaboration", label: "Collaboration Board", kicker: "Real opportunities", icon: "bx-network-chart" },
  { id: "community", label: "Community Posts", kicker: "Live discussions", icon: "bx-conversation" },
  { id: "messages", label: "Direct Messaging", kicker: "Encrypted player chat", icon: "bx-message-square-dots" },
  { id: "safety", label: "Block / Report", kicker: "Persistent trust controls", icon: "bx-shield-quarter" },
  { id: "matching", label: "Player Matching", kicker: "Explainable tech matching", icon: "bx-git-compare" },
  { id: "profiles", label: "Tech Profiles", kicker: "Verified GitHub evidence", icon: "bx-chip" },
];

const DEFAULT_MATCHING_PREFERENCE: MatchingPreference = {
  goal: "Project teammate",
  mode: "Balanced",
  preferredDomain: "Any",
  weeklyAvailability: "Any",
  experiencePreference: "Similar",
  discoveryEnabled: true,
};

const DEFAULT_MATCHING_ELIGIBILITY: MatchingEligibility = {
  eligible: false,
  reason: "GITHUB_NOT_CONNECTED",
  requiredProjects: 2,
  verifiedProjects: 0,
  githubConnected: false,
  techStackReady: false,
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DA";
}

function Avatar({ person, size = "normal" }: { person: Pick<HubPerson, "name" | "avatarUrl" | "useInitials">; size?: "small" | "normal" | "large" }) {
  return (
    <span className={`hub-avatar hub-avatar-${size}`} aria-hidden="true">
      {person.avatarUrl && !person.useInitials
        ? <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />
        : initials(person.name)}
    </span>
  );
}

function Metric({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return <article className="hub-metric"><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function SectionHeader({ index, title, copy, aside }: { index: string; title: string; copy: string; aside?: ReactNode }) {
  return (
    <header className="hub-section-header">
      <div><p>{index} / Player Hub</p><h2>{title}</h2><span>{copy}</span></div>
      {aside && <div className="hub-section-aside">{aside}</div>}
    </header>
  );
}

function HubModal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="hub-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="hub-modal" role="dialog" aria-modal="true" aria-labelledby="hub-modal-title">
        <header>
          <div><p>{eyebrow}</p><h2 id="hub-modal-title">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close"><i className="bx bx-x" /></button>
        </header>
        <div className="hub-modal-content">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="hub-empty"><i className="bx bx-orbit" /><strong>{title}</strong><span>{copy}</span></div>;
}

function PlayerHubSkeleton() {
  return (
    <main className="player-hub-page player-hub-skeleton" aria-label="Loading Player Hub" aria-busy="true">
      <header className="hub-skeleton-hero">
        <div><i className="hub-skeleton-line short" /><i className="hub-skeleton-title" /><i className="hub-skeleton-line long" /><i className="hub-skeleton-line medium" /></div>
        <div className="hub-skeleton-live"><i /><span><b /><b /></span></div>
      </header>
      <section className="hub-skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <article key={index}><i /><b /><span /></article>)}</section>
      <nav className="hub-skeleton-nav">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</nav>
      <section className="hub-skeleton-stage">
        <header><div><i className="hub-skeleton-line short" /><i className="hub-skeleton-heading" /><i className="hub-skeleton-line long" /></div><i className="hub-skeleton-control" /></header>
        <div className="hub-skeleton-toolbar"><i /><i /><i /></div>
        <div className="hub-skeleton-player-grid">{Array.from({ length: 4 }, (_, index) => <article key={index}><header><i className="avatar" /><span><b /><b /></span><em /></header><div className="chips"><i /><i /><i /></div><div className="facts"><i /><i /><i /><i /></div><footer><i /><i /><i /></footer></article>)}</div>
      </section>
    </main>
  );
}

function MessageDeliveryState({ message }: { message: EncryptedDirectMessage }) {
  if (message.clientState === "encrypting") return <i className="bx bx-lock-alt message-state pending" title="Encrypting" aria-label="Encrypting" />;
  if (message.clientState === "queued") return <i className="bx bx-cloud-off message-state queued" title="Waiting for connection" aria-label="Waiting for connection" />;
  if (message.clientState === "sending") return <i className="bx bx-time-five message-state pending" title="Sending" aria-label="Sending" />;
  if (message.clientState === "failed") return <i className="bx bx-error-circle message-state failed" title="Not sent" aria-label="Not sent" />;
  if (message.readAt) return <i className="bx bx-check-double message-state read" title="Read" aria-label="Read" />;
  if (message.deliveredAt) return <i className="bx bx-check-double message-state delivered" title="Delivered" aria-label="Delivered" />;
  return <i className="bx bx-check message-state sent" title="Sent to server" aria-label="Sent to server" />;
}

function FormAnimatedSelect({ name, defaultValue, options }: { name: string; defaultValue: string; options: AnimatedSelectOption<string>[] }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="hub-animated-field">
      <span>{name === "type" ? "Type" : name === "domain" ? "Domain" : name === "reason" ? "Reason" : name}</span>
      <AnimatedSelect value={value} onChange={setValue} options={options} ariaLabel={name} />
      <input type="hidden" name={name} value={value} />
    </label>
  );
}

function RepositoryLanguageEvidence({ project, compact = false }: { project: SharedProject; compact?: boolean }) {
  const github = project.github;
  if (!github) return null;
  const languages = (github.languages || []).slice(0, compact ? 3 : 6);
  return (
    <section className={`hub-repository-evidence${compact ? " compact" : ""}`} aria-label={`GitHub languages for ${project.title}`}>
      <header>
        <div>
          <span>GitHub language percentages</span>
          <strong>{project.title}</strong>
        </div>
        <b>{languages.length} detected</b>
      </header>
      {languages.length > 0 ? (
        <div className="hub-language-list">
          {languages.map((language) => (
            <div key={language.name}>
              <span>{language.name}</span>
              <i><em style={{ width: `${Math.max(language.percentage, 1)}%` }} /></i>
              <b>{language.percentage.toFixed(language.percentage < 10 ? 1 : 0)}%</b>
            </div>
          ))}
        </div>
      ) : <p>GitHub returned no language data for this repository.</p>}
    </section>
  );
}

function verifiedTechProfile(player: Pick<HubPerson, "topTechStack" | "topTechStackProjectCount">) {
  const stack = Array.isArray(player.topTechStack) ? player.topTechStack.slice(0, 3) : [];
  const confidence = stack.map((item) => ({
    name: item.name,
    confidence: Math.max(1, Math.min(100, item.percentage)),
    evidence: `${item.projectCount} eligible project${item.projectCount === 1 ? "" : "s"} · weighted GitHub language evidence`,
  }));
  return {
    primary: stack.map((item) => item.name),
    confidence,
    repositoryCount: player.topTechStackProjectCount || 0,
    dsaLanguage: stack.find((item) => ["C++", "Python", "Java", "JavaScript", "TypeScript", "Kotlin", "Go", "Rust"].includes(item.name))?.name || "No verified signal",
  };
}

function chatErrorMessage(reason: unknown) {
  if (reason instanceof PlayerHubRequestError) return reason.message;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "No internet connection. Your message will be sent when you reconnect.";
  }
  if (reason instanceof DOMException && reason.name === "OperationError") {
    return "Message encryption failed. Check the conversation key and retry.";
  }
  return reason instanceof Error ? reason.message : "Message delivery failed. Select Retry.";
}

export default function PlayerHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = user?.uid || "";
  const currentName = user?.displayName || "Player";

  const [activeSection, setActiveSection] = useState<HubSection>("discover");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<HubOverview>({ playerCount: 0, sharedProjectCount: 0, collaborationCount: 0, communityCount: 0, unreadMessages: 0 });
  const [players, setPlayers] = useState<HubPlayer[]>([]);
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [collaborations, setCollaborations] = useState<CollaborationPost[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [collaborationApplications, setCollaborationApplications] = useState<CollaborationApplication[]>([]);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EncryptedDirectMessage[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [chatIdentity, setChatIdentity] = useState<ChatIdentity | null>(null);
  const [chatIdentityAction, setChatIdentityAction] = useState<ChatIdentityAction | null>(null);
  const [chatIdentityError, setChatIdentityError] = useState("");
  const [showChatSecurity, setShowChatSecurity] = useState(false);
  const [composer, setComposer] = useState("");
  const [chatError, setChatError] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [stackFilter, setStackFilter] = useState("All stacks");
  const [projectFilter, setProjectFilter] = useState("All domains");
  const [collaborationFilter, setCollaborationFilter] = useState("All types");
  const [communityFilter, setCommunityFilter] = useState("All posts");
  const [conversationQuery, setConversationQuery] = useState("");
  const [matchingPreference, setMatchingPreference] = useState<MatchingPreference>(DEFAULT_MATCHING_PREFERENCE);
  const [matchingEligibility, setMatchingEligibility] = useState<MatchingEligibility>(DEFAULT_MATCHING_ELIGIBILITY);
  const [matchingResults, setMatchingResults] = useState<PlayerMatchRecommendation[]>([]);
  const [matchingModelVersion, setMatchingModelVersion] = useState("tech-match-v1");
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingSaving, setMatchingSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [modalError, setModalError] = useState("");
  const [busyId, setBusyId] = useState("");
  const messageTimelineRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<DirectConversation[]>([]);
  const flushQueueRef = useRef(false);
  const flushRequestedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const typingTimerRef = useRef<number | null>(null);
  const typingIdleTimerRef = useRef<number | null>(null);
  const typingSentRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const requestedSection = searchParams.get("section") as HubSection | null;
    if (requestedSection && SECTION_META.some((item) => item.id === requestedSection)) {
      setActiveSection(requestedSection);
    }
    const requestedConversation = searchParams.get("conversation");
    if (requestedConversation && conversations.some((item) => item.id === requestedConversation)) {
      setActiveSection("messages");
      setActiveConversationId(requestedConversation);
    }
  }, [conversations, searchParams]);

  const refreshOverview = useCallback(async () => setOverview(await PlayerHubApi.overview()), []);
  const refreshPlayers = useCallback(async () => setPlayers(await PlayerHubApi.players()), []);
  const refreshProjects = useCallback(async () => setProjects(await PlayerHubApi.projects()), []);
  const refreshCollaborations = useCallback(async () => setCollaborations(await PlayerHubApi.collaborations()), []);
  const refreshCommunity = useCallback(async () => setCommunityPosts(await PlayerHubApi.community()), []);
  const refreshConversations = useCallback(async () => {
    const data = await PlayerHubApi.conversations();
    setConversations(data);
    setActiveConversationId((current) => current ?? data[0]?.id ?? null);
  }, []);
  const refreshBlocks = useCallback(async () => setBlockedPlayers(await PlayerHubApi.blocks()), []);
  const refreshMatching = useCallback(async () => {
    setMatchingLoading(true);
    try {
      const result = await PlayerHubApi.matchingRecommendations();
      setMatchingPreference(result.preference);
      setMatchingEligibility(result.eligibility);
      setMatchingResults(result.eligibility.eligible ? result.items : []);
      setMatchingModelVersion(result.modelVersion);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Player matches could not load.");
    } finally {
      setMatchingLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshOverview(), refreshPlayers(), refreshProjects(), refreshCollaborations(),
        refreshCommunity(), refreshConversations(), refreshBlocks(), refreshMatching(),
      ]);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Player Hub could not load.");
    } finally {
      setLoading(false);
    }
  }, [refreshBlocks, refreshCollaborations, refreshCommunity, refreshConversations, refreshMatching, refreshOverview, refreshPlayers, refreshProjects]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (!currentUserId) return;
    void ensureChatIdentity(currentUserId)
      .then((identity) => {
        setChatIdentity(identity);
        setChatIdentityAction(null);
        setChatIdentityError("");
      })
      .catch((reason) => {
        setChatIdentity(null);
        if (reason instanceof ChatIdentityActionError) {
          setChatIdentityAction(reason.action);
          setChatIdentityError(reason.message);
          return;
        }
        setChatIdentityAction(null);
        setChatIdentityError(reason instanceof Error ? reason.message : "Secure chat key unavailable.");
      });
  }, [currentUserId]);

  useEffect(() => {
    if (activeSection === "matching") void refreshMatching();
  }, [activeSection, refreshMatching]);

  const loadMessages = useCallback(async (conversationId: string, quiet = false) => {
    const conversation = conversationsRef.current.find((item) => item.id === conversationId);
    if (!conversation || !chatIdentity) return;
    try {
      const queuedMessages = await OfflineMessageQueue.listForConversation(conversationId).catch(() => []);
      let serverMessages: EncryptedDirectMessage[] = [];
      if (navigator.onLine) {
        try {
          serverMessages = await PlayerHubApi.messages(conversationId);
        } catch (reason) {
          setChatError(chatErrorMessage(reason));
        }
      }
      const queuedRows: EncryptedDirectMessage[] = queuedMessages.map((message) => ({
        id: message.clientId,
        senderId: message.senderId,
        ciphertext: message.ciphertext,
        iv: message.iv,
        algorithm: message.algorithm,
        senderKeyVersion: message.senderKeyVersion,
        createdAt: message.createdAt,
        deliveredAt: null,
        readAt: null,
        editedAt: null,
        deletedAt: null,
        clientState: message.state,
        clientError: message.lastError,
      }));
      const data = [...serverMessages, ...queuedRows]
        .filter((message, index, rows) => rows.findIndex((item) => item.id === message.id) === index)
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
      setMessages(data);
      const next: Record<string, string> = {};
      if (chatIdentity && conversation.peer.chatPublicKey) {
        await Promise.all(data.map(async (message) => {
          if (message.deletedAt) { next[message.id] = "Message deleted"; return; }
          try {
            next[message.id] = await decryptDirectMessage(message.ciphertext, message.iv, chatIdentity, conversation.peer.chatPublicKey as JsonWebKey, conversationId);
          } catch {
            next[message.id] = "Encrypted message could not be decrypted on this device.";
          }
        }));
      }
      setDecrypted(next);
      if (navigator.onLine) {
        await PlayerHubApi.markRead(conversationId);
        setConversations((current) => {
          const target = current.find((item) => item.id === conversationId);
          if (!target || target.unreadCount === 0) return current;
          return current.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item);
        });
        setOverview((current) => ({ ...current, unreadMessages: Math.max(0, current.unreadMessages - (conversation.unreadCount || 0)) }));
      }
    } catch (reason) {
      if (!quiet) setChatError(chatErrorMessage(reason));
    }
  }, [chatIdentity]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; payload?: Record<string, unknown> }>).detail;
      const type = detail?.type || "";
      if (!type.startsWith("player_hub.") && type !== "players.changed" && type !== "profile.changed") return;
      if (type === "player_hub.messages.changed") {
        const conversationId = String(detail?.payload?.conversationId || "");
        const changeType = String(detail?.payload?.changeType || "");
        const actorUserId = String(detail?.payload?.actorUserId || "");
        const isOwnConfirmedSend = changeType === "sent" && actorUserId === currentUserId;
        if (!isOwnConfirmedSend) {
          void refreshConversations();
          if (conversationId && conversationId === activeConversationId) void loadMessages(conversationId, true);
          void refreshOverview();
        }
        return;
      }
      if (type === "player_hub.typing") {
        const conversationId = String(detail?.payload?.conversationId || "");
        const active = detail?.payload?.active === true;
        setTypingConversationId(active ? conversationId : null);
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        if (active) typingTimerRef.current = window.setTimeout(() => setTypingConversationId(null), 3500);
        return;
      }
      if (type.includes("community")) void refreshCommunity();
      else if (type.includes("collaboration")) void refreshCollaborations();
      else if (type.includes("shared_projects")) void refreshProjects();
      else if (type.includes("safety") || type === "players.changed") { void refreshPlayers(); void refreshBlocks(); void refreshConversations(); }
      else if (type.includes("chat_key") || type === "profile.changed") { void refreshPlayers(); void refreshConversations(); }
      void refreshOverview();
    };
    window.addEventListener("devarena:realtime-event", handler);
    return () => window.removeEventListener("devarena:realtime-event", handler);
  }, [activeConversationId, currentUserId, loadMessages, refreshBlocks, refreshCollaborations, refreshCommunity, refreshConversations, refreshOverview, refreshPlayers, refreshProjects]);

  useEffect(() => {
    if (activeConversationId) void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const timeline = messageTimelineRef.current;
    if (!timeline || !shouldAutoScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      timeline.scrollTo({ top: timeline.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, typingConversationId]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeConversationId]);

  const allStacks = useMemo(() => ["All stacks", ...Array.from(new Set(players.flatMap((player) => verifiedTechProfile(player).primary))).sort()], [players]);
  const filteredPlayers = useMemo(() => {
    const query = discoverQuery.trim().toLowerCase();
    return players.filter((player) => {
      const tech = verifiedTechProfile(player);
      const matchesQuery = !query || [player.name, player.username, player.rank, ...tech.primary].some((value) => value.toLowerCase().includes(query));
      return matchesQuery && (stackFilter === "All stacks" || tech.primary.some((skill) => skill === stackFilter));
    });
  }, [discoverQuery, players, stackFilter]);
  const filteredProjects = useMemo(() => projects.filter((item) => projectFilter === "All domains" || item.domain === projectFilter), [projectFilter, projects]);
  const filteredCollaborations = useMemo(() => collaborations.filter((item) => collaborationFilter === "All types" || item.type === collaborationFilter), [collaborationFilter, collaborations]);
  const filteredPosts = useMemo(() => communityPosts.filter((item) => communityFilter === "All posts" || item.type === communityFilter), [communityFilter, communityPosts]);
  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    return conversations.filter((item) => !query || item.peer.name.toLowerCase().includes(query) || item.peer.username.toLowerCase().includes(query));
  }, [conversationQuery, conversations]);
  const matchingByPlayer = useMemo(() => new Map(matchingResults.map((item) => [item.player.id, item])), [matchingResults]);

  const relationshipAction = async (player: HubPlayer) => {
    if (player.relationship === "friends") { await openConversation(player); return; }
    if (player.relationship === "incoming") { navigate("/players"); return; }
    if (player.relationship === "outgoing") return;
    setBusyId(player.id);
    try {
      await sendFriendRequest(player.id);
      toast.success(`Player request sent to ${player.name}.`);
      await refreshPlayers();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Player request failed.");
    } finally { setBusyId(""); }
  };

  const openConversation = async (player: HubPlayer | HubPerson) => {
    if (!chatIdentity) {
      setActiveSection("messages");
      setSearchParams({ section: "messages" });
      setModal(null);
      toast.error("Protect or restore secure messaging before opening a conversation.");
      return;
    }
    setBusyId(player.id);
    try {
      const conversation = await PlayerHubApi.createConversation(player.id);
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      setActiveConversationId(conversation.id);
      setActiveSection("messages");
      setSearchParams({ section: "messages", conversation: conversation.id });
      setModal(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Conversation could not start.");
    } finally { setBusyId(""); }
  };

  const toggleProjectSave = async (project: SharedProject) => {
    setBusyId(project.id);
    try {
      await PlayerHubApi.saveProject(project.id, !project.savedByMe);
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, savedByMe: !item.savedByMe, saveCount: Math.max(0, item.saveCount + (item.savedByMe ? -1 : 1)) } : item));
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Project save failed."); }
    finally { setBusyId(""); }
  };

  const toggleBlock = async (playerId: string, blocked: boolean) => {
    setBusyId(playerId);
    try {
      await PlayerHubApi.blockPlayer(playerId, blocked);
      toast.success(blocked ? "Player blocked." : "Player unblocked.");
      await Promise.all([refreshPlayers(), refreshBlocks(), refreshConversations()]);
      setModal(null);
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Block action failed."); }
    finally { setBusyId(""); }
  };

  const openApplications = async (post: CollaborationPost) => {
    setBusyId(post.id);
    try {
      const data = await PlayerHubApi.collaborationApplications(post.id);
      setCollaborationApplications(data);
      setModal({ type: "applications", post });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Applications could not load.");
    } finally {
      setBusyId("");
    }
  };

  const updateApplicationStatus = async (postId: string, applicationId: string, status: string) => {
    setBusyId(applicationId);
    try {
      await PlayerHubApi.setCollaborationApplicationStatus(postId, applicationId, status);
      setCollaborationApplications((current) => current.map((item) => item.id === applicationId ? { ...item, status } : item));
      toast.success(`Application marked ${status.toLowerCase()}.`);
      await refreshCollaborations();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Application could not update.");
    } finally {
      setBusyId("");
    }
  };

  const submitModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    setModalError("");
    const data = new FormData(event.currentTarget);
    try {
      if (modal.type === "create-collaboration") {
        await PlayerHubApi.createCollaboration({
          title: data.get("title"), description: data.get("description"), type: data.get("type"), domain: data.get("domain"),
          skills: String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
          commitment: data.get("commitment"), positions: Number(data.get("positions")), deadline: data.get("deadline") || null,
        });
        await refreshCollaborations();
        toast.success("Collaboration posted.");
      } else if (modal.type === "apply") {
        await PlayerHubApi.applyCollaboration(modal.post.id, { introduction: data.get("introduction"), availability: data.get("availability") });
        await refreshCollaborations();
        toast.success("Application sent.");
      } else if (modal.type === "create-community") {
        await PlayerHubApi.createCommunityPost({ type: data.get("type"), title: data.get("title"), content: data.get("content"), codeSnippet: data.get("codeSnippet") });
        await refreshCommunity();
        toast.success("Community post published.");
      } else if (modal.type === "comments") {
        await PlayerHubApi.commentCommunityPost(modal.post.id, String(data.get("content") || ""));
        await refreshCommunity();
        toast.success("Comment added.");
      } else if (modal.type === "report") {
        await PlayerHubApi.report({ subjectType: modal.subjectType, subjectId: modal.subjectId, reason: data.get("reason"), details: data.get("details") });
        toast.success("Report submitted for review.");
      }
      setModal(null);
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : "Request failed.");
    }
  };

  const deliverQueuedMessage = useCallback(async (queued: QueuedEncryptedMessage) => {
    const conversation = conversationsRef.current.find((item) => item.id === queued.conversationId);
    if (!conversation) {
      await OfflineMessageQueue.update(queued.clientId, { state: "failed", lastError: "The conversation is no longer available." });
      setMessages((current) => current.map((item) => item.id === queued.clientId
        ? { ...item, clientState: "failed", clientError: "The conversation is no longer available." }
        : item));
      return "failed" as const;
    }
    if (!navigator.onLine) {
      await OfflineMessageQueue.update(queued.clientId, { state: "queued", lastError: "Waiting for connection." });
      setMessages((current) => current.map((item) => item.id === queued.clientId
        ? { ...item, clientState: "queued", clientError: "Waiting for connection." }
        : item));
      return "retry" as const;
    }

    try {
      await OfflineMessageQueue.update(queued.clientId, { state: "sending", attempts: queued.attempts + 1, lastError: undefined });
      setMessages((current) => current.map((item) => item.id === queued.clientId
        ? { ...item, clientState: "sending", clientError: undefined }
        : item));
      const saved = await PlayerHubApi.sendMessage(queued.conversationId, {
        clientId: queued.clientId,
        ciphertext: queued.ciphertext,
        iv: queued.iv,
        algorithm: queued.algorithm,
        senderKeyVersion: queued.senderKeyVersion,
      });
      await OfflineMessageQueue.update(queued.clientId, { state: "sent", lastError: undefined });
      await OfflineMessageQueue.remove(queued.clientId);
      setMessages((current) => {
        const next = current.filter((item) => item.id !== queued.clientId && item.id !== saved.id);
        return [...next, saved].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
      });
      setDecrypted((current) => {
        const next = { ...current };
        if (next[queued.clientId]) next[saved.id] = next[queued.clientId];
        delete next[queued.clientId];
        return next;
      });
      setChatError("");
      return "sent" as const;
    } catch (reason) {
      const message = chatErrorMessage(reason);
      const retryable = reason instanceof PlayerHubRequestError ? reason.retryable : !navigator.onLine;
      const nextState = retryable ? "queued" : "failed";
      await OfflineMessageQueue.update(queued.clientId, {
        state: nextState,
        attempts: queued.attempts + 1,
        lastError: message,
      }).catch(() => undefined);
      setMessages((current) => current.map((item) => item.id === queued.clientId
        ? { ...item, clientState: nextState, clientError: message }
        : item));
      setChatError(message);
      return retryable ? "retry" as const : "failed" as const;
    }
  }, []);

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine) return;
    if (flushQueueRef.current) {
      flushRequestedRef.current = true;
      return;
    }
    flushQueueRef.current = true;
    try {
      do {
        flushRequestedRef.current = false;
        const queued = await OfflineMessageQueue.list();
        for (const message of queued) {
          if (!navigator.onLine) break;
          const result = await deliverQueuedMessage(message);
          if (result === "retry") break;
        }
      } while (flushRequestedRef.current && navigator.onLine);
    } catch (reason) {
      setChatError(chatErrorMessage(reason));
    } finally {
      flushQueueRef.current = false;
    }
  }, [deliverQueuedMessage]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setChatError("Connection restored. Sending queued messages…");
      void flushOutbox().finally(() => setChatError(""));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setChatError("No internet connection. New messages will stay here and send automatically when you reconnect.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine) void flushOutbox();
    else handleOffline();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushOutbox]);

  useEffect(() => {
    if (chatIdentity && conversations.length && navigator.onLine) void flushOutbox();
  }, [chatIdentity, conversations.length, flushOutbox]);

  const retryQueuedMessage = useCallback(async (clientId: string) => {
    const queued = (await OfflineMessageQueue.list()).find((item) => item.clientId === clientId);
    if (!queued) {
      setChatError("This queued message is no longer available.");
      return;
    }
    await OfflineMessageQueue.update(clientId, { state: "queued", lastError: undefined });
    await flushOutbox();
  }, [flushOutbox]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = composer.trim();
    if (!content || !activeConversation || !chatIdentity || !activeConversation.peer.chatPublicKey) return;
    if (content.length > 5000) {
      setChatError("The message is too long. Keep direct messages under 5,000 characters.");
      return;
    }

    const conversationId = activeConversation.id;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    let queuedPersisted = false;
    const encryptingMessage: EncryptedDirectMessage = {
      id: optimisticId,
      senderId: currentUserId,
      ciphertext: "",
      iv: "",
      algorithm: "AES-GCM",
      senderKeyVersion: chatIdentity.keyVersion,
      createdAt,
      deliveredAt: null,
      readAt: null,
      editedAt: null,
      deletedAt: null,
      clientState: "encrypting",
    };

    shouldAutoScrollRef.current = true;
    setMessages((current) => [...current, encryptingMessage]);
    setDecrypted((current) => ({ ...current, [optimisticId]: content }));
    setConversations((current) => current.map((item) => item.id === conversationId
      ? { ...item, lastMessageAt: createdAt }
      : item));
    setComposer("");
    setChatError("");

    try {
      const encryptedMessage = await encryptDirectMessage(
        content,
        chatIdentity,
        activeConversation.peer.chatPublicKey as JsonWebKey,
        conversationId,
      );
      const queued: QueuedEncryptedMessage = {
        clientId: optimisticId,
        conversationId,
        senderId: currentUserId,
        ciphertext: encryptedMessage.ciphertext,
        iv: encryptedMessage.iv,
        algorithm: encryptedMessage.algorithm,
        senderKeyVersion: encryptedMessage.senderKeyVersion,
        createdAt,
        state: "queued",
        attempts: 0,
      };
      await OfflineMessageQueue.put(queued);
      queuedPersisted = true;
      setMessages((current) => current.map((item) => item.id === optimisticId
        ? {
          ...item,
          ciphertext: encryptedMessage.ciphertext,
          iv: encryptedMessage.iv,
          algorithm: encryptedMessage.algorithm,
          senderKeyVersion: encryptedMessage.senderKeyVersion,
          clientState: "queued",
        }
        : item));

      if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
      typingSentRef.current = false;
      if (navigator.onLine) void PlayerHubApi.setTyping(conversationId, false).catch(() => undefined);

      if (!navigator.onLine) {
        setIsOnline(false);
        setChatError("No internet connection. Your message is queued and will send automatically when you reconnect.");
      } else {
        void flushOutbox();
      }
    } catch (reason) {
      const message = chatErrorMessage(reason);
      setChatError(message);
      if (!queuedPersisted) {
        setMessages((current) => current.filter((item) => item.id !== optimisticId));
        setDecrypted((current) => {
          const next = { ...current };
          delete next[optimisticId];
          return next;
        });
        setConversations((current) => current.map((item) => item.id === conversationId
          ? { ...item, lastMessageAt: activeConversation.lastMessageAt }
          : item));
        setComposer(content);
      }
    }
  };

  const stopTyping = useCallback((conversationId?: string) => {
    if (typingIdleTimerRef.current) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (conversationId && typingSentRef.current) {
      void PlayerHubApi.setTyping(conversationId, false).catch(() => undefined);
    }
    typingSentRef.current = false;
  }, []);

  useEffect(() => () => {
    if (activeConversationId) stopTyping(activeConversationId);
  }, [activeConversationId, stopTyping]);

  const changeComposer = (value: string) => {
    setComposer(value);
    if (!activeConversation || !chatIdentity) return;
    const hasText = value.trim().length > 0;
    if (!hasText) {
      stopTyping(activeConversation.id);
      return;
    }
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      void PlayerHubApi.setTyping(activeConversation.id, true).catch(() => {
        typingSentRef.current = false;
      });
    }
    if (typingIdleTimerRef.current) window.clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = window.setTimeout(() => stopTyping(activeConversation.id), 1400);
  };

  const handleChatReady = (identity: ChatIdentity) => {
    setChatIdentity(identity);
    setChatIdentityAction(null);
    setChatIdentityError("");
    setChatError("");
    setShowChatSecurity(false);
  };

  const saveMatchingPreference = async (next: MatchingPreference) => {
    setMatchingPreference(next);
    setMatchingSaving(true);
    try {
      const saved = await PlayerHubApi.updateMatchingPreferences(next);
      setMatchingPreference(saved);
      await refreshMatching();
      toast.success("Player matching preferences updated.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Matching preferences could not update.");
    } finally {
      setMatchingSaving(false);
    }
  };

  const sendMatchingFeedback = async (playerId: string, action: "Good match" | "Not relevant" | "Hide") => {
    setBusyId(playerId);
    try {
      await PlayerHubApi.matchingFeedback(playerId, action);
      if (action === "Hide") setMatchingResults((current) => current.filter((item) => item.player.id !== playerId));
      else await refreshMatching();
      toast.success(action === "Good match" ? "Match feedback saved." : action === "Hide" ? "Player hidden from matching." : "Recommendation feedback saved.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Matching feedback could not save.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <PlayerHubSkeleton />;

  return (
    <main className="player-hub-page animated-page">
      <header className="player-hub-hero page-reveal">
        <div className="player-hub-title-block">
          <p>Community systems / Live player data</p>
          <h1>Player Hub</h1>
          <span>Discover real DevArena players, collaborate around public work, publish community signals, and communicate through encrypted direct messages.</span>
        </div>
        <div className="hub-live-status"><i /><div><strong>Live systems</strong><span>{currentName} · database-backed · real-time synchronized</span></div></div>
      </header>

      <section className="hub-metrics page-reveal" style={{ "--reveal-order": 1 } as CSSProperties}>
        <Metric label="Registered players" value={overview.playerCount} helper="Real DevArena accounts" />
        <Metric label="Shared projects" value={overview.sharedProjectCount} helper="Explicitly public work" />
        <Metric label="Open collaborations" value={overview.collaborationCount} helper="Accepting applications" />
        <Metric label="Unread messages" value={overview.unreadMessages} helper="Synced across sessions" />
      </section>

      <nav className="hub-section-nav page-reveal" style={{ "--reveal-order": 2 } as CSSProperties} aria-label="Player Hub sections">
        {SECTION_META.map((section, index) => (
          <button type="button" key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => { setActiveSection(section.id); setSearchParams({ section: section.id }); }}>
            <span>{String(index + 1).padStart(2, "0")}</span><i className={`bx ${section.icon}`} /><div><strong>{section.label}</strong><small>{section.kicker}</small></div>
            {section.id === "messages" && overview.unreadMessages > 0 && <b>{overview.unreadMessages > 99 ? "99+" : overview.unreadMessages}</b>}
          </button>
        ))}
      </nav>

      <div className="hub-section-stage page-reveal" style={{ "--reveal-order": 3 } as CSSProperties}>
        {activeSection === "discover" && <section className="hub-section">
          <SectionHeader index="01" title="Discover Players" copy="Search the live DevArena player directory. Technology filters and explainable match scores use verified Top Tech Stack, project domains, DSA, activity, availability, and collaboration preferences." aside={<span className="hub-ai-label"><i className="bx bx-sparkles" /> Tech Match v1</span>} />
          <div className="hub-toolbar">
            <label className="hub-search"><i className="bx bx-search" /><input value={discoverQuery} onChange={(event) => setDiscoverQuery(event.target.value)} placeholder="Search player, username, rank, or technology" /></label>
            <label className="hub-filter"><span>Technology</span><AnimatedSelect value={stackFilter} onChange={setStackFilter} options={allStacks.map((stack) => ({ value: stack, label: stack }))} ariaLabel="Filter players by technology" /></label>
            <span className="hub-result-count">{filteredPlayers.length} players</span>
          </div>
          <div className="discover-grid">
            {filteredPlayers.map((player) => {
              const tech = verifiedTechProfile(player);
              const match = matchingByPlayer.get(player.id);
              return <article className="player-discovery-card" key={player.id}>
                <div className="player-card-topline"><div className="player-identity"><Avatar person={player} /><div><h3>{player.name}</h3><p>@{player.username}</p></div></div><div className="match-score"><strong>{match ? `${match.score}%` : "—"}</strong><span>{match ? "Tech match" : "Connected/pending"}</span></div></div>
                <div className="hub-chip-row">{tech.primary.length ? tech.primary.map((skill) => <span key={skill}>{skill}</span>) : <span>No eligible project technologies</span>}</div>
                <dl className="player-signal-grid"><div><dt>Rank</dt><dd>{player.rank}</dd></div><div><dt>Arena Score</dt><dd>{player.arenaScore}</dd></div><div><dt>Connection</dt><dd>{player.relationship}</dd></div><div><dt>Secure chat</dt><dd>{player.chatReady ? "Key ready" : "Not activated"}</dd></div></dl>
                <div className="match-reason"><i className="bx bx-bulb" /><span>{match?.reasons[0] || "Recommendations exclude existing friends, blocked players, and pending requests."}</span></div>
                <div className="hub-card-actions">
                  <button type="button" onClick={() => setModal({ type: "player", player })}>View profile</button>
                  <button type="button" disabled={busyId === player.id || player.relationship === "outgoing" || player.blockedByMe} onClick={() => void relationshipAction(player)}>{player.blockedByMe ? "Blocked" : player.relationship === "friends" ? "Message" : player.relationship === "incoming" ? "Review request" : player.relationship === "outgoing" ? "Requested" : "Connect"}</button>
                  <button type="button" onClick={() => setModal({ type: "report", subjectType: "player", subjectId: player.id, subject: player.name })}>Report</button>
                </div>
              </article>;
            })}
          </div>
        </section>}

        {activeSection === "projects" && <section className="hub-section">
          <SectionHeader index="02" title="Shared Projects" copy="Every card is an actual project that its owner deliberately made public. Save work, open the public evidence page, or contact connected owners." />
          <div className="hub-toolbar hub-toolbar-compact"><label className="hub-filter"><span>Domain</span><AnimatedSelect value={projectFilter} onChange={setProjectFilter} options={["All domains", ...Array.from(new Set(projects.map((item) => item.domain)))].map((domain) => ({ value: domain, label: domain }))} ariaLabel="Filter shared projects by domain" /></label><span className="hub-result-count">{filteredProjects.length} projects</span></div>
          {filteredProjects.length === 0 ? <EmptyState title="No shared projects yet" copy="Projects appear here after their owners enable public sharing." /> : <div className="shared-project-grid">{filteredProjects.map((project) => <article className="shared-project-card" key={project.id}>
            <header><div><p>{project.domain}</p><h3>{project.title}</h3><span>by @{project.owner.username}</span></div><Avatar person={project.owner} /></header>
            <p>{project.description || "No public description was supplied."}</p>
            <RepositoryLanguageEvidence project={project} compact />
            <div className="project-progress"><i style={{ width: `${project.metrics.milestoneProgress}%` }} /></div>
            <dl className="project-facts"><div><dt>Milestones</dt><dd>{project.metrics.completedMilestones}/{project.metrics.totalMilestones}</dd></div><div><dt>Sessions</dt><dd>{project.metrics.totalSessions}</dd></div><div><dt>Status</dt><dd>{project.status.replaceAll("_", " ")}</dd></div><div><dt>Last activity</dt><dd><LiveDateTime value={project.metrics.lastActivityDate} /></dd></div></dl>
            <div className="hub-card-actions"><button type="button" onClick={() => setModal({ type: "project", project })}>Details</button>{project.shareSlug && <button type="button" onClick={() => navigate(`/shared/projects/${project.shareSlug}`)}>Open project</button>}<button type="button" disabled={busyId === project.id} onClick={() => void toggleProjectSave(project)}>{project.savedByMe ? "Saved" : "Save"} · {project.saveCount}</button><button type="button" onClick={() => void openConversation(project.owner)}>Message owner</button></div>
          </article>)}</div>}
        </section>}

        {activeSection === "collaboration" && <section className="hub-section">
          <SectionHeader index="03" title="Collaboration Board" copy="Publish real opportunities, apply with a clear introduction, and keep application state synchronized for both accounts." aside={<button className="hub-primary-action" type="button" onClick={() => setModal({ type: "create-collaboration" })}>Post opportunity</button>} />
          <div className="hub-toolbar hub-toolbar-compact"><label className="hub-filter"><span>Type</span><AnimatedSelect value={collaborationFilter} onChange={setCollaborationFilter} options={["All types", ...Array.from(new Set(collaborations.map((item) => item.type)))].map((value) => ({ value, label: value }))} ariaLabel="Filter collaboration opportunities by type" /></label><span className="hub-result-count">{filteredCollaborations.length} opportunities</span></div>
          {filteredCollaborations.length === 0 ? <EmptyState title="No collaboration posts" copy="Create the first structured opportunity for the DevArena network." /> : <div className="collaboration-list">{filteredCollaborations.map((post, index) => <article className="collaboration-card" key={post.id}>
            <span className="collaboration-index">{String(index + 1).padStart(2, "0")}</span><div className="collaboration-main"><div className="collaboration-meta"><b>{post.type}</b><b>{post.domain}</b><b>{post.status}</b></div><h3>{post.title}</h3><p>{post.description}</p><div className="hub-chip-row">{post.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><footer><span><i className="bx bx-user" /> @{post.author.username}</span><span><i className="bx bx-time" /> {post.commitment}</span><span><i className="bx bx-group" /> {post.positions} positions</span><span><i className="bx bx-file" /> {post.applicationCount} applications</span>{post.deadline && <span><i className="bx bx-calendar" /> <LiveDateTime value={post.deadline} mode="date" /></span>}</footer></div>
            <div className="collaboration-actions">{post.isOwner ? <><button type="button" disabled={busyId === post.id} onClick={() => void openApplications(post)}>Applications</button><button type="button" onClick={() => void PlayerHubApi.setCollaborationStatus(post.id, post.status === "Open" ? "Closed" : "Open").then(refreshCollaborations).catch((reason) => toast.error(reason.message))}>{post.status === "Open" ? "Close post" : "Reopen"}</button></> : <button type="button" disabled={post.appliedByMe || post.status !== "Open"} onClick={() => setModal({ type: "apply", post })}>{post.appliedByMe ? post.myApplicationStatus || "Applied" : "Apply"}</button>}<button type="button" onClick={() => void openConversation(post.author)}>Message</button><button type="button" onClick={() => setModal({ type: "report", subjectType: "collaboration", subjectId: post.id, subject: post.title })}>Report</button></div>
          </article>)}</div>}
        </section>}

        {activeSection === "community" && <section className="hub-section">
          <SectionHeader index="04" title="Community Posts" copy="Publish deliberate technical discussions, project updates, questions, resources, and code-review requests using real player identities." aside={<button className="hub-primary-action" type="button" onClick={() => setModal({ type: "create-community" })}>Create post</button>} />
          <div className="hub-toolbar hub-toolbar-compact"><label className="hub-filter"><span>Post type</span><AnimatedSelect value={communityFilter} onChange={setCommunityFilter} options={["All posts", ...Array.from(new Set(communityPosts.map((item) => item.type)))].map((value) => ({ value, label: value }))} ariaLabel="Filter community posts by type" /></label><span className="hub-result-count">{filteredPosts.length} posts</span></div>
          {filteredPosts.length === 0 ? <EmptyState title="No community posts" copy="Publish a useful technical signal instead of a disposable status update." /> : <div className="community-feed">{filteredPosts.map((post) => <article className="community-post" key={post.id}>
            <header><div className="player-identity community-author"><Avatar person={post.author} size="small" /><div><strong>{post.author.name}</strong><span>@{post.author.username} · <LiveDateTime value={post.createdAt} /></span></div></div><b>{post.type}</b></header><h3>{post.title}</h3><p>{post.content}</p>{post.codeSnippet && <pre><code>{post.codeSnippet}</code></pre>}
            {post.comments.slice(-2).map((comment) => <div className="community-comment-preview" key={comment.id}><strong>@{comment.author.username}</strong><span>{comment.content}</span></div>)}
            <footer><button type="button" className={post.reactedByMe ? "active" : ""} onClick={() => void PlayerHubApi.reactCommunityPost(post.id, !post.reactedByMe).then(refreshCommunity).catch((reason) => toast.error(reason.message))}><i className="bx bx-like" /> {post.reactionCount}</button><button type="button" onClick={() => setModal({ type: "comments", post })}><i className="bx bx-message-rounded" /> {post.commentCount}</button><button type="button" className={post.savedByMe ? "active" : ""} onClick={() => void PlayerHubApi.saveCommunityPost(post.id, !post.savedByMe).then(refreshCommunity).catch((reason) => toast.error(reason.message))}><i className="bx bx-bookmark" /> {post.saveCount}</button><button type="button" onClick={() => setModal({ type: "report", subjectType: "post", subjectId: post.id, subject: post.title })}><i className="bx bx-flag" /> Report</button></footer>
          </article>)}</div>}
        </section>}

        {activeSection === "messages" && <section className="hub-section">
          <SectionHeader index="05" title="Direct Messaging" copy="Messages are AES-GCM ciphertext in the database. Cross-browser recovery uses Google Authenticator: the chat private key is encrypted at rest and released to your signed-in session only after a valid time-based one-time code." aside={<div className="hub-security-actions"><span className={`hub-security-state ${chatIdentity ? "ready" : "warning"}`}><i className={`bx ${chatIdentity ? "bx-lock" : "bx-error"}`} /> {chatIdentity ? "Authenticator protected" : "Key action required"}</span>{chatIdentity && <button type="button" className="hub-encryption-button" onClick={() => setShowChatSecurity((current) => !current)}>{showChatSecurity ? "Close security" : "Manage security"}</button>}</div>} />
          {chatIdentityError && !chatIdentityAction && <div className="hub-chat-warning"><i className="bx bx-error-circle" /><span>{chatIdentityError}</span></div>}
          {(chatIdentityAction || showChatSecurity) && currentUserId && <SecureChatRecoveryPanel userId={currentUserId} mode={showChatSecurity && chatIdentity ? "MANAGE" : chatIdentityAction || "SETUP_REQUIRED"} message={chatIdentityError} onReady={handleChatReady} onClose={showChatSecurity ? () => setShowChatSecurity(false) : undefined} />}
          {(chatError || !isOnline) && <div className={`hub-chat-warning ${isOnline ? "" : "offline"}`}><i className={`bx ${isOnline ? "bx-info-circle" : "bx-wifi-off"}`} /><span>{chatError || "No internet connection. Messages will remain queued until connectivity returns."}</span></div>}
          <div className="message-workspace">
            <aside className="conversation-panel"><label className="hub-search"><i className="bx bx-search" /><input value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="Search conversations" /></label><div className="conversation-list">{filteredConversations.length === 0 ? <EmptyState title="No conversations" copy="Connect with a player, then choose Message." /> : filteredConversations.map((conversation) => <button type="button" className={activeConversationId === conversation.id ? "active" : ""} key={conversation.id} onClick={() => { setActiveConversationId(conversation.id); setSearchParams({ section: "messages", conversation: conversation.id }); }}><Avatar person={conversation.peer} size="small" /><div><strong>{conversation.peer.name}</strong><span>@{conversation.peer.username} · Encrypted conversation</span></div>{conversation.lastMessageAt && <small><LiveDateTime value={conversation.lastMessageAt} mode="time" /></small>}{conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}</button>)}</div></aside>
            <div className="chat-panel">{activeConversation ? <><header className="chat-header"><div className="player-identity chat-person"><Avatar person={activeConversation.peer} size="small" /><div><h3>{activeConversation.peer.name}</h3><span>@{activeConversation.peer.username}</span></div></div><div className="chat-controls"><span className="encryption-state"><i className="bx bx-lock-alt" /> Encrypted · AES-GCM</span><button type="button" onClick={() => setModal({ type: "report", subjectType: "conversation", subjectId: activeConversation.id, subject: activeConversation.peer.name })}>Report</button><button type="button" onClick={() => void toggleBlock(activeConversation.peer.id, true)}>Block</button></div></header><div className="message-timeline" ref={messageTimelineRef} onScroll={(event) => { const element = event.currentTarget; shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90; }}><div className="encryption-notice"><i className="bx bx-lock" /><span>The server stores message ciphertext. New browsers restore the secure-message key only after a valid Google Authenticator code; the recovery key material is encrypted at rest.</span></div>{messages.map((message) => {
                  const mine = message.senderId === currentUserId;
                  return <div className={`message-row ${mine ? "mine" : ""}`} key={message.id}>
                    {!mine && <Avatar person={activeConversation.peer} size="small" />}
                    <div className="message-bubble">
                      <p>{decrypted[message.id] || (chatIdentity && activeConversation.peer.chatPublicKey ? "Decrypting…" : "Encrypted message")}</p>
                      <span className="message-meta">
                        <LiveDateTime value={message.createdAt} mode="time" />
                        {mine && <MessageDeliveryState message={message} />}
                      </span>
                      {mine && message.clientState === "queued" && <small className="message-client-note">Waiting for connection</small>}
                      {mine && message.clientState === "failed" && <small className="message-client-note failed">{message.clientError || "Message delivery failed."} <button type="button" onClick={() => void retryQueuedMessage(message.id)}>Retry</button></small>}
                    </div>
                  </div>;
                })}{typingConversationId === activeConversation.id && <div className="typing-indicator"><i /><i /><i /><span>{activeConversation.peer.name} is typing</span></div>}</div><form className="message-composer" onSubmit={sendMessage}><textarea value={composer} onChange={(event) => changeComposer(event.target.value)} placeholder={!chatIdentity ? "Secure key unavailable" : !activeConversation.peer.chatPublicKey ? "This player has not activated secure chat" : "Write an encrypted message"} disabled={!chatIdentity || !activeConversation.peer.chatPublicKey} rows={1} /><button type="submit" disabled={!composer.trim() || !chatIdentity || !activeConversation.peer.chatPublicKey}><i className="bx bx-send" /><span>Send</span></button></form></> : <EmptyState title="Choose a conversation" copy="Your connected player conversations appear here." />}</div>
          </div>
        </section>}


        {activeSection === "safety" && <section className="hub-section"><SectionHeader index="06" title="Block / Report" copy="Blocks are persistent and enforced by player requests, project interactions, collaboration applications, community comments, and direct messages." /><div className="safety-grid"><article><p>Blocked players</p><h3>{blockedPlayers.length}</h3><span>Blocking removes active player connections and prevents future direct interaction.</span></article><article><p>Report coverage</p><h3>5 surfaces</h3><span>Profiles, projects, collaboration posts, community posts, and direct conversations can be reported.</span></article></div>{blockedPlayers.length === 0 ? <EmptyState title="No blocked players" copy="Use Block from a player profile or direct conversation when needed." /> : <div className="blocked-player-list">{blockedPlayers.map((item) => <article key={item.id}><Avatar person={item.player} /><div><strong>{item.player.name}</strong><span>@{item.player.username} · blocked <LiveDateTime value={item.createdAt} mode="relative" /></span></div><button type="button" onClick={() => void toggleBlock(item.player.id, false)}>Unblock</button></article>)}</div>}</section>}

        {activeSection === "matching" && <section className="hub-section">
          <SectionHeader index="07" title="Player Matching" copy="Tech Match v1.1 uses verified GitHub project evidence only. Matching unlocks after two eligible projects build a live Top Tech Stack." aside={<span className="hub-ai-label"><i className="bx bx-brain" /> {matchingModelVersion}</span>} />
          {matchingLoading ? <EmptyState title="Checking matching eligibility" copy="DevArena is verifying your GitHub connection, eligible projects, and live Top Tech Stack." /> : !matchingEligibility.eligible ? <article className="matching-locked-card">
            <div className="matching-lock-icon"><i className="bx bx-lock-alt" /></div>
            <p>GitHub evidence required</p>
            <h3>{matchingEligibility.reason === "GITHUB_NOT_CONNECTED" ? "Connect GitHub to unlock matching" : matchingEligibility.reason === "TECH_STACK_NOT_READY" ? "Build your live Tech Stack" : "Add two verified GitHub projects"}</h3>
            <span>{matchingEligibility.reason === "GITHUB_NOT_CONNECTED" ? "DevArena does not calculate or display any match until your GitHub account is connected." : matchingEligibility.reason === "TECH_STACK_NOT_READY" ? "Your projects exist, but GitHub language evidence has not produced a live Top Tech Stack yet. Refresh the project languages before matching." : `Only eligible original, collaborative, or substantial-fork projects count. You currently have ${matchingEligibility.verifiedProjects} of ${matchingEligibility.requiredProjects}.`}</span>
            <div className="matching-unlock-progress" aria-label={`${matchingEligibility.verifiedProjects} of ${matchingEligibility.requiredProjects} eligible projects`}>
              <i><em style={{ width: `${Math.min(100, (matchingEligibility.verifiedProjects / Math.max(1, matchingEligibility.requiredProjects)) * 100)}%` }} /></i>
              <small>{matchingEligibility.verifiedProjects} / {matchingEligibility.requiredProjects} eligible projects</small>
            </div>
            <div className="matching-lock-checks">
              <span className={matchingEligibility.githubConnected ? "is-complete" : ""}><i className={`bx ${matchingEligibility.githubConnected ? "bx-check" : "bx-minus"}`} /> GitHub connected</span>
              <span className={matchingEligibility.verifiedProjects >= matchingEligibility.requiredProjects ? "is-complete" : ""}><i className={`bx ${matchingEligibility.verifiedProjects >= matchingEligibility.requiredProjects ? "bx-check" : "bx-minus"}`} /> {matchingEligibility.requiredProjects} eligible projects</span>
              <span className={matchingEligibility.techStackReady ? "is-complete" : ""}><i className={`bx ${matchingEligibility.techStackReady ? "bx-check" : "bx-minus"}`} /> Live Top Tech Stack</span>
            </div>
            <button type="button" className="hub-primary-action" onClick={() => navigate(matchingEligibility.reason === "GITHUB_NOT_CONNECTED" ? "/settings" : "/projects")}>{matchingEligibility.reason === "GITHUB_NOT_CONNECTED" ? "Connect GitHub" : "Open Projects"}</button>
          </article> : <div className="matching-lab">
            <article className="matching-formula-card">
              <p>Matching controls</p>
              <h3>Shape your recommendations</h3>
              <small>Results update from live DevArena evidence. Private repository names and source code never enter the matching response.</small>
              <div className="matching-preference-grid">
                <label><span>Goal</span><AnimatedSelect value={matchingPreference.goal} onChange={(value) => setMatchingPreference((current) => ({ ...current, goal: value as MatchingPreference["goal"] }))} options={["Project teammate", "DSA partner", "Hackathon teammate", "Mentor", "Mentee", "Open-source contributor"].map((value) => ({ value, label: value }))} ariaLabel="Matching goal" /></label>
                <label><span>Mode</span><AnimatedSelect value={matchingPreference.mode} onChange={(value) => setMatchingPreference((current) => ({ ...current, mode: value as MatchingPreference["mode"] }))} options={["Balanced", "Similar", "Complementary"].map((value) => ({ value, label: value }))} ariaLabel="Matching mode" /></label>
                <label><span>Preferred domain</span><AnimatedSelect value={matchingPreference.preferredDomain} onChange={(value) => setMatchingPreference((current) => ({ ...current, preferredDomain: value as MatchingPreference["preferredDomain"] }))} options={["Any", "Fullstack", "App", "AI", "Other"].map((value) => ({ value, label: value }))} ariaLabel="Preferred project domain" /></label>
                <label><span>Weekly availability</span><AnimatedSelect value={matchingPreference.weeklyAvailability} onChange={(value) => setMatchingPreference((current) => ({ ...current, weeklyAvailability: value as MatchingPreference["weeklyAvailability"] }))} options={["Any", "1-3 hours", "4-7 hours", "8-12 hours", "12+ hours"].map((value) => ({ value, label: value }))} ariaLabel="Weekly availability" /></label>
                <label><span>Experience</span><AnimatedSelect value={matchingPreference.experiencePreference} onChange={(value) => setMatchingPreference((current) => ({ ...current, experiencePreference: value as MatchingPreference["experiencePreference"] }))} options={["Similar", "More experienced", "Less experienced", "Any"].map((value) => ({ value, label: value }))} ariaLabel="Experience preference" /></label>
                <label className="matching-discovery-toggle"><input type="checkbox" checked={matchingPreference.discoveryEnabled} onChange={(event) => setMatchingPreference((current) => ({ ...current, discoveryEnabled: event.target.checked }))} /><span>Allow my profile in matching</span></label>
              </div>
              <button type="button" className="hub-primary-action" disabled={matchingSaving} onClick={() => void saveMatchingPreference(matchingPreference)}>{matchingSaving ? "Updating…" : "Update recommendations"}</button>
              <div className="matching-weight-list"><span><b>01</b>Verified technology compatibility<i /></span><span><b>02</b>Project-domain and collaboration intent<i /></span><span><b>03</b>DSA, activity, experience, and availability<i /></span></div>
            </article>
            <div className="matching-result-list">
              {matchingResults.length === 0 ? <EmptyState title="No eligible recommendations" copy="Only players with connected GitHub accounts, at least two eligible projects, and a live Top Tech Stack can appear here." /> : matchingResults.map((match, index) => {
                const player = players.find((item) => item.id === match.player.id);
                return <article key={match.player.id}>
                  <span className="matching-rank">{String(index + 1).padStart(2, "0")}</span>
                  <Avatar person={match.player} />
                  <div className="matching-player-copy"><h3>{match.player.name}</h3><span>@{match.player.username} · {match.mode} · {match.goal}</span><p>{match.reasons.join(" ")}</p><div className="matching-component-row"><span>Tech {match.components.tech}</span><span>Domain {match.components.domain}</span><span>Activity {match.components.activity}</span><span>DSA {match.components.dsa}</span></div></div>
                  <strong>{match.score}%<small>Compatibility</small></strong>
                  <div className="matching-result-actions">{player && <button type="button" onClick={() => setModal({ type: "player", player })}>View profile</button>}{player && <button type="button" onClick={() => void relationshipAction(player)}>Connect</button>}<button type="button" disabled={busyId === match.player.id} onClick={() => void sendMatchingFeedback(match.player.id, "Good match")}>Good match</button><button type="button" disabled={busyId === match.player.id} onClick={() => void sendMatchingFeedback(match.player.id, "Not relevant")}>Not relevant</button><button type="button" disabled={busyId === match.player.id} onClick={() => void sendMatchingFeedback(match.player.id, "Hide")}>Hide</button></div>
                </article>;
              })}
            </div>
          </div>}
        </section>}

        {activeSection === "profiles" && <section className="hub-section"><SectionHeader index="08" title="Tech Profiles" copy="Technology signals come from each player’s live Top Tech Stack across eligible original, collaborative, and substantial fork projects, including private repositories without exposing repository details." aside={<span className="hub-ai-label"><i className="bx bx-chip" /> GitHub evidence</span>} /><div className="tech-profile-grid">{players.slice(0, 10).map((player) => { const profile = verifiedTechProfile(player); return <article key={player.id}><div className="player-identity"><Avatar person={player} /><div><h3>{player.name}</h3><p>@{player.username}</p></div></div><p>Eligible projects: <strong>{profile.repositoryCount}</strong> · Language signal: <strong>{profile.dsaLanguage}</strong></p>{profile.confidence.length ? profile.confidence.map((skill) => <div className="skill-confidence" key={skill.name}><header><span>{skill.name}</span><b>{skill.confidence}%</b></header><i><em style={{ width: `${skill.confidence}%` }} /></i><small>{skill.evidence}</small></div>) : <p>No eligible project technology evidence is available.</p>}</article>; })}</div></section>}

      </div>

      {modal && <HubModal title={modal.type === "player" ? modal.player.name : modal.type === "project" ? modal.project.title : modal.type === "apply" ? "Apply to collaborate" : modal.type === "applications" ? "Collaboration applications" : modal.type === "comments" ? "Community discussion" : modal.type === "report" ? "Submit report" : modal.type === "create-collaboration" ? "Post collaboration" : "Create community post"} eyebrow="Player Hub action" onClose={() => { setModal(null); setModalError(""); }}>
        {modal.type === "player" && (() => { const tech = verifiedTechProfile(modal.player); const match = matchingByPlayer.get(modal.player.id); return <div className="player-modal-profile"><div className="player-identity"><Avatar person={modal.player} size="large" /><div><h3>{modal.player.name}</h3><p>@{modal.player.username} · {modal.player.rank} · {modal.player.arenaScore} SP</p></div></div><div className="hub-chip-row">{tech.primary.length ? tech.primary.map((skill) => <span key={skill}>{skill}</span>) : <span>No eligible project technologies</span>}</div><div className="match-reason"><i className="bx bx-sparkles" /><span>{match ? `${match.score}% live match. ${match.reasons.join(" ")}` : "No active recommendation is available because this player may already be connected, pending, hidden, or excluded by safety rules."}</span></div><div className="hub-modal-actions"><button type="button" onClick={() => { setModal(null); navigate(`/player-hub/players/${modal.player.id}/work`); }}>View DSA & Projects</button><button type="button" onClick={() => void relationshipAction(modal.player)}>{modal.player.relationship === "friends" ? "Open message" : "Connect"}</button><button type="button" onClick={() => void toggleBlock(modal.player.id, !modal.player.blockedByMe)}>{modal.player.blockedByMe ? "Unblock" : "Block"}</button><button type="button" onClick={() => setModal({ type: "report", subjectType: "player", subjectId: modal.player.id, subject: modal.player.name })}>Report</button></div></div>; })()}
        {modal.type === "project" && <div className="project-modal-detail"><div className="player-identity"><Avatar person={modal.project.owner} /><div><h3>{modal.project.title}</h3><p>@{modal.project.owner.username} · {modal.project.domain}</p></div></div><p>{modal.project.description || "No public description."}</p><RepositoryLanguageEvidence project={modal.project} /><dl className="project-modal-grid"><div><dt>Status</dt><dd>{modal.project.status.replaceAll("_", " ")}</dd></div><div><dt>Milestones</dt><dd>{modal.project.metrics.completedMilestones}/{modal.project.metrics.totalMilestones}</dd></div><div><dt>Sessions</dt><dd>{modal.project.metrics.totalSessions}</dd></div><div><dt>Saved</dt><dd>{modal.project.saveCount} players</dd></div></dl><div className="hub-modal-actions">{modal.project.shareSlug && <button type="button" onClick={() => navigate(`/shared/projects/${modal.project.shareSlug}`)}>Open public project</button>}<button type="button" onClick={() => void openConversation(modal.project.owner)}>Message owner</button><button type="button" onClick={() => setModal({ type: "report", subjectType: "project", subjectId: modal.project.id, subject: modal.project.title })}>Report</button></div></div>}
        {modal.type === "applications" && <div className="application-review-list">{collaborationApplications.length === 0 ? <EmptyState title="No applications yet" copy="Applications will appear here in real time." /> : collaborationApplications.map((application) => <article key={application.id}><div className="player-identity"><Avatar person={application.applicant} size="small" /><div><strong>{application.applicant.name}</strong><span>@{application.applicant.username} · {application.status}</span></div></div><p>{application.introduction}</p><small>{application.availability} · <LiveDateTime value={application.createdAt} /></small><div className="hub-card-actions"><button type="button" disabled={busyId === application.id} onClick={() => void updateApplicationStatus(modal.post.id, application.id, "Shortlisted")}>Shortlist</button><button type="button" disabled={busyId === application.id} onClick={() => void updateApplicationStatus(modal.post.id, application.id, "Accepted")}>Accept</button><button type="button" disabled={busyId === application.id} onClick={() => void updateApplicationStatus(modal.post.id, application.id, "Rejected")}>Reject</button><button type="button" onClick={() => void openConversation(application.applicant)}>Message</button></div></article>)}</div>}
        {(modal.type === "create-collaboration" || modal.type === "apply" || modal.type === "create-community" || modal.type === "comments" || modal.type === "report") && <form className="hub-modal-form" onSubmit={submitModal}>
          {modalError && <div className="hub-form-error"><i className="bx bx-error-circle" />{modalError}</div>}
          {modal.type === "create-collaboration" && <><label><span>Opportunity title</span><input name="title" required minLength={5} /></label><label><span>Description</span><textarea name="description" required minLength={20} rows={5} /></label><div className="hub-form-grid"><label><span>Type</span><FormAnimatedSelect name="type" defaultValue="Project partner" options={["Project partner", "Hackathon team", "Open-source contributor", "Code reviewer", "Study partner"].map((value) => ({ value, label: value }))} /></label><label><span>Domain</span><FormAnimatedSelect name="domain" defaultValue="Fullstack" options={["Fullstack", "App Development", "AI/ML", "DSA", "Other"].map((value) => ({ value, label: value }))} /></label></div><label><span>Required skills, comma separated</span><input name="skills" required placeholder="React, Node.js, PostgreSQL" /></label><div className="hub-form-grid"><label><span>Commitment</span><input name="commitment" required placeholder="5 hours / week" /></label><label><span>Positions</span><input name="positions" type="number" min="1" max="20" defaultValue="1" /></label></div><label><span>Deadline (optional)</span><input name="deadline" type="date" /></label></>}
          {modal.type === "apply" && <><p>Apply to <strong>{modal.post.title}</strong> by @{modal.post.author.username}.</p><label><span>Why are you relevant?</span><textarea name="introduction" required minLength={15} rows={5} /></label><label><span>Your availability</span><input name="availability" required placeholder="6 hours / week, evenings" /></label></>}
          {modal.type === "create-community" && <><label><span>Post type</span><FormAnimatedSelect name="type" defaultValue="Technical Discussion" options={["Technical Discussion", "Project Update", "Question", "Resource", "Code Review"].map((value) => ({ value, label: value }))} /></label><label><span>Title</span><input name="title" required minLength={5} /></label><label><span>Content</span><textarea name="content" required minLength={10} rows={6} /></label><label><span>Code snippet (optional)</span><textarea name="codeSnippet" rows={5} /></label></>}
          {modal.type === "comments" && <><div className="modal-comment-list">{modal.post.comments.map((comment) => <article key={comment.id}><strong>@{comment.author.username}</strong><span>{comment.content}</span><small><LiveDateTime value={comment.createdAt} /></small></article>)}{modal.post.comments.length === 0 && <span>No comments yet.</span>}</div><label><span>Add a useful comment</span><textarea name="content" required minLength={2} rows={4} /></label></>}
          {modal.type === "report" && <><p>Report: <strong>{modal.subject}</strong></p><label><span>Reason</span><FormAnimatedSelect name="reason" defaultValue="Spam or manipulation" options={["Spam or manipulation", "Harassment or abuse", "Scam or unsafe link", "Impersonation", "Inappropriate content", "Other"].map((value) => ({ value, label: value }))} /></label><label><span>Details</span><textarea name="details" rows={5} placeholder="Provide enough context for review." /></label></>}
          <button type="submit">{modal.type === "report" ? "Submit report" : modal.type === "comments" ? "Add comment" : modal.type === "apply" ? "Send application" : "Publish"}</button>
        </form>}
      </HubModal>}
    </main>
  );
}
