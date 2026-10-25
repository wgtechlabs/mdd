const endpoint = "/api/mdd/plugins/feedback";

for (const widget of document.querySelectorAll("[data-mdd-feedback]")) {
  const buttons = [...widget.querySelectorAll("[data-mdd-vote]")];
  const result = widget.querySelector("[data-mdd-feedback-result]");
  if (!result || buttons.length !== 2) continue;

  const key = `mdd-feedback:${window.location.pathname}`;
  const showSummary = (summary) => {
    result.textContent =
      summary.helpfulPercentage === null
        ? "No responses yet."
        : `${summary.helpfulPercentage}% of responses found this page helpful.`;
    for (const button of buttons) button.hidden = true;
  };

  try {
    const response = await fetch(
      `${endpoint}?page=${encodeURIComponent(window.location.pathname)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (!response.ok) continue;
    const summary = await response.json();
    widget.hidden = false;
    let saved = false;
    try {
      saved = window.localStorage.getItem(key) === "submitted";
    } catch {
      // Storage can be disabled; the server remains authoritative.
    }
    if (saved) showSummary(summary);

    for (const button of buttons) {
      button.addEventListener("click", async () => {
        for (const voteButton of buttons) voteButton.disabled = true;
        try {
          const submitted = await fetch(endpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              page: window.location.pathname,
              vote: button.dataset.mddVote,
            }),
          });
          if (!submitted.ok) {
            result.textContent =
              submitted.status === 429
                ? "Too many responses. Please try again later."
                : "Couldn't submit feedback. Please try again.";
            for (const voteButton of buttons) voteButton.disabled = false;
            return;
          }
          try {
            window.localStorage.setItem(key, "submitted");
          } catch {
            // The UI still prevents another vote on this page view.
          }
          const current = await fetch(
            `${endpoint}?page=${encodeURIComponent(window.location.pathname)}`,
            { cache: "no-store", headers: { Accept: "application/json" } },
          );
          if (!current.ok) throw new Error("Feedback summary unavailable.");
          showSummary(await current.json());
        } catch {
          result.textContent =
            "Your response was saved, but the result is unavailable right now.";
          for (const voteButton of buttons) voteButton.hidden = true;
        }
      });
    }
  } catch {
    // Static hosting and unavailable databases leave the feedback section hidden.
  }
}
