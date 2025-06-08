import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { TextInput, Spinner, ProgressBar } from "@inkjs/ui";
import { HistoryManager, type PodcastHistoryEntry } from "./utils/history-manager";

interface AppState {
  stage: "input" | "history" | "downloading" | "uploading" | "complete" | "error";
  playlistUrl: string;
  currentVideo: string;
  progress: number;
  total: number;
  feedUrl: string;
  error: string;
}

export class CLIController {
  private state: AppState = {
    stage: "input",
    playlistUrl: "",
    currentVideo: "",
    progress: 0,
    total: 0,
    feedUrl: "",
    error: "",
  };

  private updateCallback?: () => void;

  setState(updates: Partial<AppState>) {
    this.state = { ...this.state, ...updates };
    this.updateCallback?.();
  }

  getState() {
    return this.state;
  }

  onUpdate(callback: () => void) {
    this.updateCallback = callback;
  }

  updateProgress(progress: number, total: number, currentVideo: string) {
    this.setState({ progress, total, currentVideo });
  }

  setStage(stage: AppState["stage"]) {
    this.setState({ stage });
  }

  setError(error: string) {
    this.setState({ stage: "error", error });
  }

  setComplete(feedUrl: string) {
    this.setState({ stage: "complete", feedUrl });
  }
}

interface AppProps {
  controller: CLIController;
  onSubmit: (playlistUrl: string) => Promise<void>;
}

function App({ controller, onSubmit }: AppProps) {
  const [, forceUpdate] = useState({});
  const [history, setHistory] = useState<PodcastHistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const state = controller.getState();
  const { exit } = useApp();

  useEffect(() => {
    controller.onUpdate(() => forceUpdate({}));
    loadHistory();
  }, [controller]);

  const loadHistory = async () => {
    const historyManager = new HistoryManager();
    const entries = await historyManager.loadHistory();
    setHistory(entries);
  };

  useInput((input, key) => {
    if ((state.stage === "input" || state.stage === "complete") && input === "H") {
      controller.setState({ stage: "history" });
    } else if (state.stage === "history") {
      if (key.escape || input === "q") {
        controller.setState({ stage: "input" });
      } else if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(history.length - 1, selectedIndex + 1));
      }
    } else if (state.stage === "complete" && (key.escape || input === "q")) {
      exit();
    } else if (state.stage === "error" && (key.escape || input === "q")) {
      exit();
    }
  });

  const handleSubmit = async (value: string) => {
    controller.setState({ playlistUrl: value, stage: "downloading" });
    await onSubmit(value);
  };

  if (state.stage === "input") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube Playlist to Podcast Converter
        </Text>

        <Box marginTop={1}>
          <Text>Enter YouTube playlist URL: </Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            placeholder="https://youtube.com/playlist?list=..."
            onSubmit={handleSubmit}
          />
        </Box>

        <Box marginTop={2}>
          <Text color="gray">
            Press <Text color="yellow">Shift+H</Text> to view history
          </Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "history") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          📚 Podcast History
        </Text>

        {history.length === 0 ? (
          <Box marginTop={1}>
            <Text color="gray">No podcasts created yet.</Text>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column">
            {history.map((entry, index) => (
              <Box
                key={entry.id}
                marginTop={index > 0 ? 1 : 0}
                paddingX={1}
                borderStyle="single"
                borderColor={selectedIndex === index ? "yellow" : undefined}
              >
                <Box flexDirection="column">
                  <Box>
                    <Text color="yellow" bold>
                      {entry.playlistTitle}
                    </Text>
                  </Box>
                  <Box>
                    <Text color="gray">
                      by {entry.channelName} • {entry.episodeCount} episodes
                    </Text>
                  </Box>
                  <Box>
                    <Text color="gray" dimColor>
                      {new Date(entry.createdAt).toLocaleString()}
                    </Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text color="green">Feed URL: </Text>
                  </Box>
                  <Box>
                    <Text color="green" wrap="wrap">
                      {entry.feedUrl}
                    </Text>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Box marginTop={2}>
          <Text color="gray">
            Use <Text color="yellow">↑↓</Text> to navigate • Press <Text color="yellow">q</Text> or <Text color="yellow">ESC</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "downloading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          📥 Downloading from YouTube
        </Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> {state.currentVideo || "Fetching playlist info..."}</Text>
        </Box>
        {state.total > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text>
              Progress: {state.progress}/{state.total}
            </Text>
            <Box marginTop={1}>
              <ProgressBar value={(state.progress / state.total) * 100} />
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "uploading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          ☁️  Uploading to Cloudflare R2
        </Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Uploading episode {state.progress}/{state.total}</Text>
        </Box>
        <Box marginTop={1}>
          <ProgressBar value={(state.progress / state.total) * 100} />
        </Box>
      </Box>
    );
  }

  if (state.stage === "complete") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>
          ✅ Success! Your podcast is ready
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Podcast RSS Feed URL:</Text>
          <Text color="yellow" bold>
            {state.feedUrl}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">
            Add this URL to your favorite podcast app to subscribe!
          </Text>
        </Box>
        <Box marginTop={2}>
          <Text color="gray">
            Press <Text color="yellow">Shift+H</Text> to view history • Press <Text color="yellow">q</Text> to exit
          </Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          ❌ Error occurred
        </Text>
        <Box marginTop={1}>
          <Text>{state.error}</Text>
        </Box>
        <Box marginTop={2}>
          <Text color="gray">
            Press <Text color="yellow">q</Text> to exit
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
}

export function startCLI(
  onSubmit: (playlistUrl: string, controller: CLIController) => Promise<void>
): CLIController {
  const controller = new CLIController();

  const { unmount } = render(
    <App
      controller={controller}
      onSubmit={(url) => onSubmit(url, controller)}
    />
  );

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });

  return controller;
}