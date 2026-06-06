"""
AgentAudit 模块2 — LLM Provider Layer 统一调用层

提供统一接口调用不同 LLM 模型（OpenAI / Claude / DeepSeek / Qwen 等）。
底层可切换，上层无感知。

推荐生产环境使用 LiteLLM 统一调用。
"""
import os
import json
from dataclasses import dataclass
from typing import List, Optional
from abc import ABC, abstractmethod


# ============ 数据模型 ============

@dataclass
class ChatMessage:
    role: str   # system / user / assistant
    content: str


@dataclass
class LLMResponse:
    model: str
    content: str
    usage: dict


# ============ 抽象基类 ============

class BaseLLMProvider(ABC):
    """LLM Provider 抽象基类"""

    @abstractmethod
    def chat(self, messages: List[ChatMessage], **kwargs) -> LLMResponse:
        pass


# ============ OpenAI Provider ============

class OpenAIProvider(BaseLLMProvider):
    """OpenAI API 调用封装 (gpt-4o / gpt-4o-mini)"""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model

    def chat(self, messages: List[ChatMessage], **kwargs) -> LLMResponse:
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("pip install openai")

        client = OpenAI(api_key=self.api_key)
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=kwargs.get("temperature", 0.3),
            max_tokens=kwargs.get("max_tokens", 4096),
        )
        choice = response.choices[0]
        return LLMResponse(
            model=self.model,
            content=choice.message.content or "",
            usage={
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
            },
        )


# ============ DeepSeek Provider ============

class DeepSeekProvider(BaseLLMProvider):
    """DeepSeek API 调用封装"""

    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "")
        self.model = model

    def chat(self, messages: List[ChatMessage], **kwargs) -> LLMResponse:
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("pip install openai")

        client = OpenAI(api_key=self.api_key, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=kwargs.get("temperature", 0.3),
            max_tokens=kwargs.get("max_tokens", 4096),
        )
        choice = response.choices[0]
        return LLMResponse(
            model=self.model,
            content=choice.message.content or "",
            usage={
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
            },
        )


# ============ Mock Provider (测试用) ============

class MockProvider(BaseLLMProvider):
    """Mock LLM Provider，用于测试，返回预设响应"""

    def __init__(self, preset_response: Optional[str] = None):
        self.preset_response = preset_response

    def chat(self, messages: List[ChatMessage], **kwargs) -> LLMResponse:
        if self.preset_response:
            content = self.preset_response
        else:
            # 生成一个示例漏洞响应
            content = json.dumps({
                "vulnerabilities": [
                    {
                        "title": "Reentrancy in withdraw()",
                        "severity": "High",
                        "confidence": 85,
                        "location": "withdraw() function, lines 42-48",
                        "description": "The withdraw() function sends ETH before updating the balance state variable, making it vulnerable to reentrancy attacks.",
                        "impact": "An attacker can drain all funds from the contract using a malicious fallback function.",
                        "recommendation": "Move the balance update before the external call (CEI pattern), or use OpenZeppelin ReentrancyGuard."
                    }
                ]
            }, ensure_ascii=False)
        return LLMResponse(
            model="mock-model",
            content=content,
            usage={"input_tokens": 0, "output_tokens": 0},
        )


# ============ Provider Factory ============

def get_provider(provider_name: str, **kwargs) -> BaseLLMProvider:
    """Provider 工厂函数"""
    providers = {
        "openai": OpenAIProvider,
        "deepseek": DeepSeekProvider,
        "mock": MockProvider,
    }
    cls = providers.get(provider_name.lower())
    if cls is None:
        raise ValueError(f"Unknown provider: {provider_name}. Available: {list(providers.keys())}")
    return cls(**kwargs)
