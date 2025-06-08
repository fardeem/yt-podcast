import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import { TextInput, Spinner, ProgressBar } from "@inkjs/ui";

interface AppState {
  stage: "input" | "downloading" | "uploading" | "complete" | "error";
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
  const state = controller.getState();

  useEffect(() => {
    controller.onUpdate(() => forceUpdate({}));
  }, [controller]);

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