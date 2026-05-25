#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gpt_login.py
===========
功能：严格从 gpt_reg_simple.py 深度对齐的独立登录/Token 刷新模块（精简纯浏览器 Sentinel 获取）。
"""

import json
import time
import uuid
import random
import string
import secrets
import hashlib
import base64
from typing import Any, Dict, Optional, Tuple, List

from curl_cffi import requests as cffi_requests
from services.email_service import EmailService

# ============================================================
# 常量配置
# ============================================================

OPENAI_AUTH_BASE = "https://auth.openai.com"
CHATGPT_BASE = "https://chatgpt.com"

# ============================================================
# 辅助函数 (严格对齐 gpt_reg_simple.py)
# ============================================================

def _random_chrome_version():
    _CHROME_PROFILES = [
        {
            "major": 131, "impersonate": "chrome131",
            "build": 6778, "patch_range": (69, 205),
            "sec_ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        },
        {
            "major": 133, "impersonate": "chrome133a",
            "build": 6943, "patch_range": (33, 153),
            "sec_ch_ua": '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        },
        {
            "major": 136, "impersonate": "chrome136",
            "build": 7103, "patch_range": (48, 175),
            "sec_ch_ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        },
    ]
    profile = random.choice(_CHROME_PROFILES)
    major = profile["major"]
    build = profile["build"]
    patch = random.randint(*profile["patch_range"])
    full_ver = f"{major}.0.{build}.{patch}"
    ua = f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{full_ver} Safari/537.36"
    return profile["impersonate"], major, full_ver, ua, profile["sec_ch_ua"]

def _make_trace_headers() -> Dict[str, str]:
    trace_id = str(random.getrandbits(64))
    parent_id = str(random.getrandbits(64))
    trace_hex = format(int(trace_id), "016x")
    parent_hex = format(int(parent_id), "016x")
    return {
        "traceparent": f"00-0000000000000000{trace_hex}-{parent_hex}-01",
        "tracestate": "dd=s:1;o:rum",
        "x-datadog-origin": "rum",
        "x-datadog-parent-id": parent_id,
        "x-datadog-sampling-priority": "1",
        "x-datadog-trace-id": trace_id,
    }

# ============================================================
# Sentinel 挑战获取 (完全从 gpt_reg_simple.py 移植)
# ============================================================

def _extract_flow_token(flows_result: Optional[dict], flow: str) -> Optional[str]:
    """从 get_sentinel_tokens 的批量结果中提取单个 flow 的 token"""
    if not flows_result or "flows" not in flows_result:
        return None
    f_data = flows_result["flows"].get(flow)
    if f_data and "token" in f_data:
        token = f_data["token"]
        if isinstance(token, dict):
            return json.dumps(token, separators=(",", ":"))
        return token
    return None


def build_sentinel_token(
    session, device_id: str, flow: str = "authorize_continue",
    user_agent=None, sec_ch_ua=None, impersonate=None, proxy=None, require_turnstile=False
) -> Optional[str]:
    """通过 Playwright 浏览器获取 sentinel token（单 flow，兼容旧调用）"""
    try:
        from services.sentinel_browser import get_sentinel_tokens
        res = get_sentinel_tokens(flows=[flow], proxy=proxy, device_id=device_id)
        return _extract_flow_token(res, flow)
    except Exception as e:
        print(f"[build_sentinel_token] 获取浏览器 Token 异常: {e}")
        return None


def prefetch_sentinel_tokens(device_id: str, proxy: str = "", flows: list = None) -> Optional[dict]:
    """预加载：一次浏览器会话获取多个 flow 的 sentinel token，避免多次启动浏览器"""
    if flows is None:
        flows = ["authorize_continue", "password_verify", "email_otp"]
    try:
        from services.sentinel_browser import get_sentinel_tokens
        print(f"[prefetch_sentinel] 预加载 sentinel tokens: {flows}")
        return get_sentinel_tokens(flows=flows, proxy=proxy, device_id=device_id)
    except Exception as e:
        print(f"[prefetch_sentinel] 预加载异常: {e}")
        return None

# ============================================================
# ChatGPT 登录类
# ============================================================

class ChatGPTLogin:
    BASE = CHATGPT_BASE
    AUTH = OPENAI_AUTH_BASE

    def __init__(self, proxy: str = ""):
        self.proxy = proxy
        self.device_id = str(uuid.uuid4())
        self.auth_session_logging_id = str(uuid.uuid4())
        
        # 随机选择指纹
        self.impersonate, self.chrome_major, self.chrome_full, self.ua, self.sec_ch_ua = _random_chrome_version()
        
        # 使用 curl_cffi Session
        session_kwargs = {"impersonate": self.impersonate, "verify": False}
        if self.proxy:
            session_kwargs["proxies"] = {"http": self.proxy, "https": self.proxy}
        self.session = cffi_requests.Session(**session_kwargs)
        
        # 初始化基础头
        self.session.headers.update({
            "User-Agent": self.ua,
            "Accept-Language": "en-US,en;q=0.9",
            "sec-ch-ua": self.sec_ch_ua,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "oai-device-id": self.device_id,
        })
        
        # 初始化 Cookie (全域同步)
        for domain in [".auth.openai.com", "auth.openai.com", ".chatgpt.com", "chatgpt.com"]:
            self.session.cookies.set("oai-did", self.device_id, domain=domain)

    def _build_api_headers(self, referer: str) -> Dict[str, str]:
        h = {
            "accept": "application/json",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "origin": self.AUTH,
            "user-agent": self.ua,
            "sec-ch-ua": self.sec_ch_ua,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "referer": referer,
            "oai-device-id": self.device_id,
        }
        h.update(_make_trace_headers())
        return h

    def login_web(self, email: str, password: str, email_service: EmailService) -> Optional[str]:
        """
        ChatGPT Web 登录获取 Token (对齐简化版)
        """
        try:
            session = self.session
            
            nav_headers = {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "user-agent": self.ua,
                "sec-ch-ua": self.sec_ch_ua,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "upgrade-insecure-requests": "1",
            }

            # Step 0: 首页访问预热 (建立基础 Cookie)
            print(f"      [登录] Step 0: 首页访问预热")
            session.get(f"{self.BASE}/", headers=nav_headers, allow_redirects=True, timeout=15)
            time.sleep(random.uniform(1, 2))

            print(f"      [登录] Step 1-2: CSRF & Signin")
            r = session.get(f"{self.BASE}/api/auth/csrf", headers={"accept": "application/json", "referer": f"{self.BASE}/"})
            csrf = r.json().get("csrfToken", "")
            
            # 补全注册机 signin 方法中的所有参数
            signin_params = {
                "prompt": "login",
                "ext-oai-did": self.device_id,
                "auth_session_logging_id": self.auth_session_logging_id,
                "ext-passkey-client-capabilities": "0000",
                "screen_hint": "login_or_signup",
                "login_hint": email,
            }
            signin_data = {
                "callbackUrl": f"{self.BASE}/",
                "csrfToken": csrf,
                "json": "true"
            }
            
            r = session.post(
                f"{self.BASE}/api/auth/signin/openai",
                params=signin_params,
                data=signin_data,
                headers={
                    "accept": "application/json",
                    "content-type": "application/x-www-form-urlencoded",
                    "referer": f"{self.BASE}/",
                    "origin": self.BASE
                },
                allow_redirects=False
            )
            signin_url = r.json().get("url", "")
            if not signin_url: return None

            print(f"      [登录] Step 3: 访问授权页")
            nav_headers["sec-fetch-site"] = "cross-site"
            r = session.get(signin_url, headers=nav_headers, allow_redirects=True)
            time.sleep(random.uniform(0.5, 1.5))

            # 预加载 sentinel tokens：一次浏览器会话获取所有 flow 的 token
            sentinel_flows = ["authorize_continue", "password_verify", "email_otp"]
            prefetched = prefetch_sentinel_tokens(self.device_id, self.proxy, sentinel_flows)
            if prefetched is None:
                print(f"      [登录] 预加载 sentinel 失败，将回退到按需获取")

            print(f"      [登录] Step 4: 提交邮箱")
            sentinel = _extract_flow_token(prefetched, "authorize_continue") or build_sentinel_token(
                session, self.device_id, "authorize_continue", self.ua, self.sec_ch_ua, proxy=self.proxy
            )
            headers = self._build_api_headers(r.url)
            headers["referer"] = f"{self.AUTH}/log-in"
            if sentinel: headers["openai-sentinel-token"] = sentinel

            r = session.post(
                f"{self.AUTH}/api/accounts/authorize/continue",
                json={"username": {"value": email, "kind": "email"}, "screen_hint": "login"},
                headers=headers
            )
            cont_url = r.json().get("continue_url", "")
            if cont_url:
                full_url = cont_url if cont_url.startswith("http") else f"{self.AUTH}{cont_url}"
                # 此步 visit 非常关键，决定了后续密码验证的 State
                r = session.get(full_url, headers=nav_headers, allow_redirects=True)

            print(f"      [登录] Step 5: 验证密码")
            sentinel_pwd = _extract_flow_token(prefetched, "password_verify") or build_sentinel_token(
                session, self.device_id, "password_verify", self.ua, self.sec_ch_ua, proxy=self.proxy
            )
            headers["referer"] = r.url
            if sentinel_pwd: headers["openai-sentinel-token"] = sentinel_pwd

            r = session.post(f"{self.AUTH}/api/accounts/password/verify", json={"password": password}, headers=headers, allow_redirects=False)
            data = r.json()
            continue_url = data.get("continue_url", "")
            page_type = (data.get("page") or {}).get("type") or ""

            # --- Step 6: 登录 OTP 验证 (如果触发) ---
            if page_type == "email_otp_verification" or "email-verification" in continue_url:
                print(f"      [登录] Step 6: 需要二次邮件认证")
                h_otp = self._build_api_headers(f"{self.AUTH}/email-verification")
                h_otp["oai-device-id"] = self.device_id

                # 初始化 OTP 发送
                session.post(f"{self.AUTH}/api/accounts/email-otp/init", json={}, headers=h_otp)

                # 确保邮箱存在 (用于刷新已删除的临时邮箱)
                email_service.create_custom_email(email)

                # 等待新验证码
                print(f"      [登录] 等待新验证码...")
                new_code = None
                for i in range(12):
                    time.sleep(5)
                    print(f"      [登录] 尝试获取验证码 ({i+1}/12)...")
                    code = email_service.fetch_verification_code(email)
                    if code:
                        new_code = code
                        break

                if new_code:
                    print(f"      [登录] 提交验证码: {new_code}")
                    sentinel_otp = _extract_flow_token(prefetched, "email_otp") or build_sentinel_token(
                        session, self.device_id, "email_otp", self.ua, self.sec_ch_ua, proxy=self.proxy
                    )
                    if sentinel_otp: h_otp["openai-sentinel-token"] = sentinel_otp

                    rv = session.post(f"{self.AUTH}/api/accounts/email-otp/validate", json={"code": new_code}, headers=h_otp)
                    if rv.status_code == 200:
                        continue_url = rv.json().get("continue_url", continue_url)

            if continue_url:
                print(f"      [登录] Step 7: 跟随回调同步 {continue_url}")
                full_url = continue_url if continue_url.startswith("http") else f"{self.AUTH}{continue_url}"
                session.get(full_url, headers=nav_headers, allow_redirects=True)
            
            # --- Step 8: 获取 accessToken ---
            print(f"      [登录] Step 8: 获取 accessToken")
            time.sleep(3)
            for _ in range(3):
                try:
                    resp = session.get(
                        f"{self.BASE}/api/auth/session",
                        headers={
                            "accept": "application/json",
                            "user-agent": self.ua,
                            "referer": f"{self.BASE}/",
                            "sec-ch-ua": self.sec_ch_ua,
                            "sec-ch-ua-mobile": "?0",
                            "sec-ch-ua-platform": '"Windows"',
                        },
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        at = resp.json().get("accessToken")
                        if at:
                            print(f"      [登录] ✅ accessToken 获取成功!")
                            return at
                    else:
                        print(f"      [登录] Step 8 状态码异常: {resp.status_code}")
                except Exception as e:
                    print(f"      [登录] Step 8 网络/解析异常: {e}")
                time.sleep(3)
            return None
        except Exception as e:
            print(f"      [!] 登录异常: {e}")
            return None
