# Void SDKs and LLM Providers

**Last Updated:** 2026-04-28

Void supports multiple LLM providers for AI features (Chat, Autocomplete, Apply, Quick Edit, SCM).

## Supported Providers

### Cloud Providers (Require API Key)

| Provider | Provider ID | API Key Format | Default Endpoint |
|----------|------------|----------------|-------------------|
| OpenAI | `openAI` | `sk-proj-key...` | api.openai.com |
| Anthropic | `anthropic` | `sk-ant-key...` | api.anthropic.com |
| Google Gemini | `gemini` | `AIzaSy...` |generativelanguage.googleapis.com |
| DeepSeek | `deepseek` | `sk-key...` | api.deepseek.com |
| Mistral | `mistral` | `api-key...` | api.mistral.ai |
| xAI (Grok) | `xAI` | `xai-key...` | api.x.ai |
| Groq | `groq` | `gsk_key...` | api.groq.com |
| OpenRouter | `openRouter` | `sk-or-key...` | openrouter.ai |
| LiteLLM | `liteLLM` | (custom) | configurable |
| Google Vertex AI | `googleVertex` | (OAuth) | us-west2 |
| Microsoft Azure | `microsoftAzure` | (Azure key) | Azure endpoint |
| AWS Bedrock | `awsBedrock` | (AWS key) | configurable |

### Local/Self-Hosted Providers

| Provider | Provider ID | Default Endpoint | Auto-Detection |
|----------|------------|------------------|----------------|
| Ollama | `ollama` | http://127.0.0.1:11434 | Yes |
| vLLM | `vLLM` | http://localhost:8000 | Yes |
| LM Studio | `lmStudio` | http://localhost:1234 | Yes |
| OpenAI-Compatible | `openAICompatible` | configurable | No |

## API Key Handling

### Security Model
- API keys are stored in Void's settings via `voidSettingsService`
- Keys are sent directly to LLM providers without retention on Void's servers
- No middleware or proxy between client and provider

### Provider Setup

Each provider requires specific configuration fields:

```typescript
// Provider settings structure (from voidSettingsTypes.ts)
type SettingsAtProvider<providerName> = {
  apiKey?: string;           // For cloud providers
  endpoint?: string;        // For local providers
  region?: string;          // Google Vertex, AWS Bedrock
  project?: string;         // Google Vertex, Microsoft Azure
  azureApiVersion?: string; // Microsoft Azure
  headersJSON?: string;     // Custom headers for OpenAI-Compatible
  _didFillInProviderSettings: boolean;
  models: VoidStatefulModelInfo[];
}
```

### Environment Variable Alternative

API keys can also be configured via environment variables in `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Google Gemini
GEMINI_API_KEY=your-key-here

# DeepSeek
DEEPSEEK_API_KEY=your-key-here

# Mistral
MISTRAL_API_KEY=your-key-here

# Groq
GROQ_API_KEY=your-key-here

# OpenRouter
OPENROUTER_API_KEY=sk-or-your-key-here
```

## Provider-Specific Notes

### Anthropic
- Supports extended reasoning with configurable budget (1024-8192 tokens)
- Uses `anthropic-style` tool format by default
- System message passed as separate field

### OpenAI
- Supports reasoning effort slider (low/medium/high) for o1/o3 models
- Uses `developer-role` for system messages on reasoning models
- Supports FIM (fill-in-middle) for autocomplete on specific models

### Google Gemini
- Uses `gemini-style` tool format
- Supports extended thinking with budget slider
- System message passed as separate field

### Ollama / vLLM / LM Studio (Local)
- Auto-detected when running locally
- Support for custom endpoints
- Reasoning output may need manual parsing for open-source models with think tags

### OpenAI-Compatible
- Generic endpoint configuration for any OpenAI-compatible provider
- Custom headers support for authentication

### Google Vertex AI
- Requires Google Cloud authentication
- Region configuration required
- Endpoint: `https://<region>-aiplatform.googleapis.com/v1`

### AWS Bedrock
- Region configuration required
- Optional custom endpoint for Bedrock Access Gateway
- LiteLLM proxy recommended for broader model support

## Model Configuration

### Default Models

Each provider has predefined default models (see `modelCapabilities.ts`):

```typescript
// Example: OpenAI defaults
'gpt-4.1',
'gpt-4.1-mini',
'gpt-4.1-nano',
'gpt-4o',
'gpt-4o-mini',
'gpt-4.5',
'gpt-4-turbo',
'o3',
'o4-mini',
'o1',
'o1-mini',
'o3-mini',

// Example: Anthropic defaults
'claude-opus-4-7',
'claude-opus-4-6',
'claude-sonnet-4-6',
'claude-haiku-4-5',
'claude-mythos',
// Plus legacy 3.x models
```

### Model Capabilities

Each model has static capabilities defined in `VoidStaticModelInfo`:

```typescript
interface VoidStaticModelInfo {
  contextWindow: number;           // Input token limit
  reservedOutputTokenSpace: number | null;  // Reserved for output
  supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated';
  specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style';
  supportsFIM: boolean;           // Fill-in-middle autocomplete
  reasoningCapabilities: false | {
    supportsReasoning: true;
    canTurnOffReasoning: boolean;
    canIOReasoning: boolean;
    reasoningReservedOutputTokenSpace?: number;
    reasoningSlider?: { type: 'budget_slider'; min: number; max: number; default: number }
                        | { type: 'effort_slider'; values: string[]; default: string };
  };
}
```

## Feature-Specific Configuration

Models can be configured per feature:

```typescript
featureNames = ['Chat', 'Ctrl+K', 'Autocomplete', 'Apply', 'SCM'] as const
type ModelSelectionOfFeature = Record<FeatureName, ModelSelection | null>
```

This allows different providers/models for different features, e.g., fast model for autocomplete, powerful model for agent mode.

## Related Files

- `src/vs/workbench/contrib/void/common/voidSettingsTypes.ts` - Provider settings types
- `src/vs/workbench/contrib/void/common/modelCapabilities.ts` - Model definitions and capabilities
- `src/vs/workbench/contrib/void/common/sendLLMMessageService.ts` - LLM service implementation
