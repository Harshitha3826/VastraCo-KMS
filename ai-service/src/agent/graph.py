import json
import logging
from typing import Optional

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from src.config import settings
from src.bedrock_client import bedrock_runtime  # explicit boto3 client, never default chain
from src.agent.prompts import SYSTEM_PROMPT
from src.agent.tools import create_tools

logger = logging.getLogger(__name__)

# ── LLM singleton ────────────────────────────────────────────────────────────
# Created once at module load.  The `client=` parameter forces ChatBedrockConverse
# to use our explicit boto3 client; LangChain will never attempt its own credential
# discovery (no ~/.aws, no instance profiles, no env-var fallback chain).
_llm = ChatBedrockConverse(
    client=bedrock_runtime,
    model=settings.BEDROCK_MODEL_ID,
    temperature=0.1,
    max_tokens=1024,
)

# ── Conversation memory ───────────────────────────────────────────────────────
# Shared across all sessions — keyed by thread_id (= session_id from the client).
# Lives in RAM; cleared on service restart.  Swap for AsyncPostgresSaver or
# AsyncRedisSaver for persistent cross-restart memory.
_memory = MemorySaver()


async def run_agent_session(
    session_id: str,
    user_message: str,
    user_token: Optional[str] = None,
) -> dict:
    """
    Invoke the LangGraph ReAct agent for one turn in a session.

    Tools are re-bound per request because the set of available tools depends on
    whether the user is authenticated (order tools require a JWT).

    Returns {"response": str, "products": list[dict]}.
    """
    tools = create_tools(
        product_service_url=settings.PRODUCT_SERVICE_URL,
        order_service_url=settings.ORDER_SERVICE_URL,
        user_token=user_token,
    )

    # create_react_agent compiles a new graph per request (cheap).
    # The shared _llm and _memory are reused across all requests.
    graph = create_react_agent(
        model=_llm,
        tools=tools,
        checkpointer=_memory,
        prompt=SYSTEM_PROMPT,
    )

    config = {"configurable": {"thread_id": session_id}}

    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_message)]},
        config=config,
    )

    messages = result.get("messages", [])
    if not messages:
        return {
            "response": "Sorry, I couldn't process your request. Please try again.",
            "products": [],
        }

    # Extract final AI response text (Nova may return a list of content blocks)
    final = messages[-1]
    content = final.content
    if isinstance(content, str):
        ai_text = content
    elif isinstance(content, list):
        ai_text = " ".join(
            b.get("text", "") if isinstance(b, dict) else str(b)
            for b in content
        ).strip()
    else:
        ai_text = str(content)

    # Extract product results from the most recent search_products tool call
    products = []
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            try:
                data = json.loads(msg.content)
                if isinstance(data, dict) and data.get("products"):
                    products = data["products"][:6]
                    break
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

    return {"response": ai_text, "products": products}
