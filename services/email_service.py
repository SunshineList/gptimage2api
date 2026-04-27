"""
邮箱服务类 - 使用临时邮箱 API
"""
import re
from typing import Optional
from curl_cffi import requests
from services.config import config


class EmailService:
    """邮箱服务类"""

    def __init__(self):
        """初始化邮箱服务"""
        self.worker_domain = config.worker_domain
        self.admin_password = config.admin_password
        self.headers = {
            "X-Admin-Token": self.admin_password
        }

        if not self.worker_domain:
            raise ValueError("Missing required configuration: WORKER_DOMAIN")

    def create_email(self):
        """
        创建随机临时邮箱
        """
        url = f"https://{self.worker_domain}/api/generate"
        try:
            res = requests.get(url, headers=self.headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                email = data.get("email")
                if email:
                    return email
                print(f"[-] 创建邮箱返回数据缺少 email 字段: {data}")
                return None
            else:
                print(f"[-] 创建邮箱接口返回错误: {res.status_code} - {res.text}")
                return None
        except Exception as e:
            print(f"[-] 创建邮箱网络异常 ({url}): {e}")
            return None

    def create_custom_email(self, email: str):
        """
        创建自定义邮箱 (用于刷新 Token 时恢复已删除的邮箱)
        """
        if not email or "@" not in email:
            return None
            
        local_part = email.split("@")[0]
        url = f"https://{self.worker_domain}/api/create"
        payload = {
            "local": local_part,
            "domainIndex": 0
        }
        
        try:
            res = requests.post(url, headers=self.headers, json=payload, timeout=10)
            if res.status_code == 200:
                print(f"[+] 自定义邮箱 {email} 已确保创建成功")
                return res.json().get("email")
            else:
                print(f"[-] 自定义邮箱创建失败: {res.status_code} - {res.text}")
                return None
        except Exception as e:
            print(f"[-] 自定义邮箱创建异常: {e}")
            return None

    def fetch_verification_code(self, email) -> str | None:
        try:
            resp = requests.get(
                f"https://{self.worker_domain}/api/emails?mailbox={email}",
                headers=self.headers,
                timeout=10
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            # 1. 优先寻找 API 已识别的 verification_code
            for mail in data:
                code = mail.get("verification_code")
                if code:
                    return str(code)
            
            # 2. 兜底：从 subject/preview 中正则提取
            for mail in data:
                content_to_check = (mail.get("subject", "") + " " + mail.get("preview", "")).lower()
                if "openai" in content_to_check or "chatgpt" in content_to_check:
                    code = self._extract_verification_code(content_to_check)
                    if code:
                        return code
        except Exception:
            pass
        return None

    def _extract_verification_code(self, text: str) -> Optional[str]:
        """从文本中提取 6 位数字验证码"""
        if not text:
            return None
        match = re.search(r'(\d{6})', text)
        if match:
            return match.group(1)
        return None

    def _fetch_email_detail(self, mail_id):
        """
        获取单封邮件详情，返回 html_content 供调用方正则匹配
        """
        url = f"https://{self.worker_domain}/api/email/{mail_id}"
        try:
            res = requests.get(url, headers=self.headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                html_content = data.get("html_content") or data.get("content")
                return None, html_content
            return None, None
        except Exception as e:
            print(f"获取邮件详情失败: {e}")
            return None, None

    def delete_email(self, email):
        """
        删除指定邮箱
        GET/DELETE /api/mailboxes?address=...
        """
        url = f"https://{self.worker_domain}/api/mailboxes"
        try:
            res = requests.delete(
                url, 
                headers=self.headers, 
                params={"address": email}, 
                timeout=10
            )
            if res.status_code == 200:
                print(f"[+] 邮箱 {email} 已成功删除")
                return True
            else:
                print(f"[-] 删除邮箱失败: {res.status_code} - {res.text}")
                return False
        except Exception as e:
            print(f"[-] 删除邮箱网络异常: {e}")
            return False
