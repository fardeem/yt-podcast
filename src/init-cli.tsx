import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import { ConfigManager, type Config } from "./config-manager";
import { validateR2Endpoint, validateR2PublicUrl, validateBucketName } from "./utils/validators";
import os from "os";
import path from "path";

type InitStage =
  | "checking"
  | "missing-deps"
  | "r2-endpoint"
  | "r2-public-url"
  | "r2-access-key"
  | "r2-secret-key"
  | "r2-bucket-name"
  | "complete"
  | "error";

interface InitState {
  stage: InitStage;
  config: Partial<Config>;
  deps: {
    ytDlp: { installed: boolean; path?: string };
    ffmpeg: { installed: boolean; path?: string };
  } | null;
  error?: string;
}

interface InitCLIProps {
  onComplete: (config: Config) => void;
  onExit: () => void;
}

export function InitCLI({ onComplete, onExit }: InitCLIProps) {
  const [state, setState] = useState<InitState>({
    stage: "checking",
    config: {},
    deps: null,
  });

  React.useEffect(() => {
    checkDependencies();
  }, []);

  const checkDependencies = async () => {
    const configManager = new ConfigManager();
    const deps = await configManager.checkDependencies();

    if (!deps.ytDlp.installed || !deps.ffmpeg.installed) {
      setState({ ...state, stage: "missing-deps", deps });
    } else {
      setState({
        ...state,
        stage: "r2-endpoint",
        deps,
        config: {
          ffmpeg: { path: deps.ffmpeg.path! },
          ytDlp: {
            path: deps.ytDlp.path!,
            outputDir: path.join(os.tmpdir(), "yt-podcast-downloads")
          },
        },
      });
    }
  };

  const handleInput = (value: string) => {
    const { stage, config } = state;

    switch (stage) {
      case "r2-endpoint":
        if (!validateR2Endpoint(value)) {
          setState({
            ...state,
            error: "Invalid R2 endpoint URL. It should be https://xxx.r2.cloudflarestorage.com"
          });
          return;
        }
        setState({
          ...state,
          stage: "r2-public-url",
          config: {
            ...config,
            r2: { ...config.r2, endpoint: value },
          },
          error: undefined,
        });
        break;

      case "r2-public-url":
        if (!validateR2PublicUrl(value)) {
          setState({
            ...state,
            error: "Invalid R2 public URL. It should be https://xxx.r2.dev"
          });
          return;
        }
        setState({
          ...state,
          stage: "r2-access-key",
          config: {
            ...config,
            r2: { ...config.r2, publicUrl: value },
          },
          error: undefined,
        });
        break;

      case "r2-access-key":
        if (!value.trim()) {
          setState({
            ...state,
            error: "Access key cannot be empty"
          });
          return;
        }
        setState({
          ...state,
          stage: "r2-secret-key",
          config: {
            ...config,
            r2: { ...config.r2, accessKey: value.trim() },
          },
          error: undefined,
        });
        break;

      case "r2-secret-key":
        if (!value.trim()) {
          setState({
            ...state,
            error: "Secret key cannot be empty"
          });
          return;
        }
        setState({
          ...state,
          stage: "r2-bucket-name",
          config: {
            ...config,
            r2: { ...config.r2, secretKey: value.trim() },
          },
          error: undefined,
        });
        break;

      case "r2-bucket-name":
        if (!validateBucketName(value)) {
          setState({
            ...state,
            error: "Invalid bucket name. Use lowercase letters, numbers, and hyphens only (3-63 chars)"
          });
          return;
        }
        const finalConfig = {
          ...config,
          r2: { ...config.r2, bucketName: value },
        } as Config;

        saveConfig(finalConfig);
        break;
    }
  };

  const saveConfig = async (config: Config) => {
    try {
      const configManager = new ConfigManager();
      await configManager.saveConfig(config);
      setState({ ...state, stage: "complete", config });
      setTimeout(() => onComplete(config), 1500);
    } catch (error) {
      setState({
        ...state,
        stage: "error",
        error: error instanceof Error ? error.message : "Failed to save config",
      });
    }
  };

  if (state.stage === "checking") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Checking dependencies...</Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "missing-deps") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          ❌ Missing Dependencies
        </Text>
        <Box marginTop={1} flexDirection="column">
          {!state.deps?.ytDlp.installed && (
            <Text>• yt-dlp is not installed</Text>
          )}
          {!state.deps?.ffmpeg.installed && (
            <Text>• ffmpeg is not installed</Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="yellow">
            Please install missing dependencies:
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">On macOS: brew install yt-dlp ffmpeg</Text>
          <Text color="gray">On Ubuntu: sudo apt install yt-dlp ffmpeg</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Press Ctrl+C to exit</Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "r2-endpoint") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Text color="green">✓ Dependencies found!</Text>
        </Box>
        <Box marginTop={1}>
          <Text>Now let's configure Cloudflare R2:</Text>
        </Box>
        <Box marginTop={1}>
          <Text>Enter your R2 endpoint URL:</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            key="r2-endpoint"
            placeholder="https://xxx.r2.cloudflarestorage.com"
            onSubmit={handleInput}
          />
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "r2-public-url") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Text>Enter your R2 public URL:</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            key="r2-public-url"
            placeholder="https://pub-xxx.r2.dev"
            onSubmit={handleInput}
          />
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "r2-access-key") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Text>Enter your R2 access key:</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            key="r2-access-key"
            placeholder="Access key ID"
            onSubmit={handleInput}
          />
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "r2-secret-key") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Text>Enter your R2 secret key:</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            key="r2-secret-key"
            placeholder="Secret access key"
            mask="*"
            onSubmit={handleInput}
          />
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "r2-bucket-name") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>
          🎵 YouTube to Podcast Converter - Setup
        </Text>
        <Box marginTop={1}>
          <Text>Enter your R2 bucket name:</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            key="r2-bucket-name"
            placeholder="my-podcast-bucket"
            onSubmit={handleInput}
          />
        </Box>
        {state.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (state.stage === "complete") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>
          ✅ Configuration saved!
        </Text>
        <Box marginTop={1}>
          <Text color="gray">Starting YouTube to Podcast Converter...</Text>
        </Box>
      </Box>
    );
  }

  if (state.stage === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          ❌ Error
        </Text>
        <Box marginTop={1}>
          <Text>{state.error}</Text>
        </Box>
      </Box>
    );
  }

  return null;
}