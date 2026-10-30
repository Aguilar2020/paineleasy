import base64
import hashlib
from cryptography.fernet import Fernet
from backend.config import settings


def _get_fernet() -> Fernet:
    raw = settings.CREDENTIALS_ENCRYPTION_KEY.encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def encrypt_secret(plain_text: str | None) -> str | None:
    """Encrypts an SSH password or private key for storage at rest."""
    if not plain_text:
        return None
    f = _get_fernet()
    return f.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: str | None) -> str | None:
    """Decrypts an encrypted SSH credential strictly in memory for SSH driver use."""
    if not cipher_text:
        return None
    f = _get_fernet()
    return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")

