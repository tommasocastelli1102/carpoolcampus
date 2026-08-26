// Notifications are derived from existing data (ride requests + chat
// messages) rather than a dedicated backend table — "seen" state lives in
// localStorage, namespaced per user id so switching accounts on the same
// browser doesn't leak one person's read state into another's.

function storageKey(kind, userId) {
  return `cc_notif_seen_${kind}_${userId}`;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — private mode / storage full, notifications just won't persist as read
  }
}

/**
 * Builds the current notification list for a user from their rides (and,
 * for confirmed/completed rides, the last message on each thread).
 *
 * rides: result of GET /rides/my
 * lastMessagesByRide: Map<rideRequestId, {id, sender_id, content, sent_at}|null>
 */
export function computeNotifications(user, rides, lastMessagesByRide) {
  const seenPending = new Set(readJSON(storageKey("pending", user.id), []));
  const seenStatus = readJSON(storageKey("status", user.id), {});
  const seenMessage = readJSON(storageKey("message", user.id), {});

  const notifications = [];

  for (const r of rides) {
    const isMineAsDriver = r.driver_id === user.id;
    const isMineAsRider = r.rider_id === user.id;

    // A) Pending requests waiting on this driver.
    if (isMineAsDriver && r.status === "pending" && !seenPending.has(r.id)) {
      const isCustom = Boolean(r.custom_time || r.custom_place);
      notifications.push({
        id: `pending-${r.id}`,
        kind: "pending",
        rideId: r.id,
        icon: isCustom ? "📝" : "🚗",
        text: `${isCustom ? "Custom request" : "Ride request"} from ${r.rider?.first_name} ${r.rider?.last_name}`,
        path: "/driver",
        at: r.created_at,
      });
    }

    // B) Status changes on requests this rider made.
    if (isMineAsRider && (r.status === "confirmed" || r.status === "declined") && seenStatus[r.id] !== r.status) {
      notifications.push({
        id: `status-${r.id}-${r.status}`,
        kind: "status",
        rideId: r.id,
        icon: r.status === "confirmed" ? "✅" : "❌",
        text: `${r.driver?.first_name} ${r.status === "confirmed" ? "confirmed" : "declined"} your ride request`,
        path: r.status === "confirmed" ? `/chat/${r.id}` : "/rider",
        at: r.created_at,
      });
    }

    // C) New chat messages from the other party.
    if ((isMineAsDriver || isMineAsRider) && (r.status === "confirmed" || r.status === "completed")) {
      const last = lastMessagesByRide.get(r.id);
      if (last && last.sender_id !== user.id && seenMessage[r.id] !== last.id) {
        const other = isMineAsDriver ? r.rider : r.driver;
        notifications.push({
          id: `message-${r.id}-${last.id}`,
          kind: "message",
          rideId: r.id,
          icon: "💬",
          text: `New message from ${other?.first_name}`,
          path: `/chat/${r.id}`,
          at: last.sent_at,
        });
      }
    }
  }

  notifications.sort((a, b) => new Date(b.at) - new Date(a.at));
  return notifications;
}

/** Marks one notification as seen so it won't reappear. */
export function markNotificationSeen(user, notification, rides) {
  if (notification.kind === "pending") {
    const key = storageKey("pending", user.id);
    const seen = new Set(readJSON(key, []));
    seen.add(notification.rideId);
    writeJSON(key, [...seen]);
  } else if (notification.kind === "status") {
    const key = storageKey("status", user.id);
    const seen = readJSON(key, {});
    const ride = rides.find((r) => r.id === notification.rideId);
    if (ride) seen[ride.id] = ride.status;
    writeJSON(key, seen);
  } else if (notification.kind === "message") {
    const key = storageKey("message", user.id);
    const seen = readJSON(key, {});
    const match = /^message-(\d+)-(\d+)$/.exec(notification.id);
    if (match) seen[match[1]] = Number(match[2]);
    writeJSON(key, seen);
  }
}

export function markAllNotificationsSeen(user, notifications, rides) {
  notifications.forEach((n) => markNotificationSeen(user, n, rides));
}
