from fastapi import FastAPI, Form, UploadFile, File
import uvicorn
import uuid
import os
from typing import Any, Dict, List, Optional

import os
import uuid
import shutil
import mimetypes
from urllib.parse import urlparse
import json

import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException,Body
from fastapi import FastAPI, Request, File, Form, UploadFile, Body, HTTPException
from extract import extract,OCR

from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
print("🤖 Initializing OpenAI client...")
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    print("✅ OpenAI API key found in environment")
    openai_client = OpenAI(api_key=openai_api_key)
    print("✅ OpenAI client initialized successfully")
else:
    print("⚠️ Warning: OPENAI_API_KEY not found in environment variables")
    openai_client = None

app = FastAPI()

origins = [
    "http://localhost:3000",   # React/Next.js local dev
    "http://127.0.0.1:3000",
     "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8000",
      "http://localhost:8000",
      "http://localhost:8585",
      "https://supa.nometria.com",
    "https://your-frontend-domain.com",  # production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # or ["*"] to allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
REQUEST_TIMEOUT = (5, 60)  # (connect, read) seconds

    

def _safe_ext_from_mime(mime: Optional[str], default=".pdf") -> str:
    if not mime:
        return default
    # Basic MIME -> extension mapping
    ext = mimetypes.guess_extension(mime.split(";")[0].strip())
    return ext or default


def _ext_from_url(url: str, default=".pdf") -> str:
    path = urlparse(url).path
    _, ext = os.path.splitext(path)
    return ext if ext else default


def _stream_download(url: str, dst_path: str) -> None:
    """
    Stream a file from HTTP(S) to dst_path with size limit and basic validations.
    Raises HTTPException on failures.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed.")

    try:
        with requests.get(url, stream=True, timeout=REQUEST_TIMEOUT) as r:
            r.raise_for_status()

            # Optional: validate content type if you only expect PDFs/images
            ctype = r.headers.get("Content-Type", "").lower()
            # You can tighten this as needed:
            allowed_prefixes = ("application/pdf", "image/", "application/octet-stream")
            if not any(ctype.startswith(p) for p in allowed_prefixes):
                # Not fatal, but you may choose to reject:
                pass

            total = 0
            with open(dst_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1 MB chunks
                    if chunk:  # filter out keep-alive chunks
                        total += len(chunk)
                        if total > MAX_DOWNLOAD_BYTES:
                            raise HTTPException(status_code=413, detail="Remote file too large.")
                        f.write(chunk)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")




def _filename_from_url(url: str, fallback_ext: str) -> str:
    try:
        name = url.split("?")[0].rsplit("/", 1)[-1]
        if not os.path.splitext(name)[1]:
            name += fallback_ext
        return name
    except Exception:
        return f"remote{fallback_ext}"

@app.post("/extract_file")
def extract_file(
    payload: dict = Body(...)
):
    print("📄 /extract_file endpoint called")
    print(f"📨 Received payload keys: {list(payload.keys())}")
    
    file_url = payload.get("file_url")
    file = payload.get("file")
    file_format = payload.get("file_format")
    
    print(f"🔍 Extracted parameters:")
    print(f"  - File URL: {file_url}")
    print(f"  - File provided: {file is not None}")
    print(f"  - File format: {file_format}")

    tmp_path = None

    if not file and not file_url:
        raise HTTPException(status_code=400, detail="Provide either `file` or `file_url`.")

    try:
        # --- Case 1: Uploaded file ---
        if file is not None:
            # Name temp file using original extension if available, else .pdf
            _, ext = os.path.splitext(file.filename or "")
            ext = ext if ext else ".pdf"
            tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")

            with open(tmp_path, "wb") as f_out:
                shutil.copyfileobj(file.file, f_out)

        # --- Case 2: Remote file via URL ---
        else:
            # Prefer extension from URL; fall back to MIME after a HEAD, else .pdf
            # First try a HEAD to guess content type (non-fatal if blocked)
            mime_guess = None
            try:
                head = requests.head(file_url, allow_redirects=True, timeout=REQUEST_TIMEOUT)
                mime_guess = head.headers.get("Content-Type")
            except requests.exceptions.RequestException:
                pass

            ext = _ext_from_url(file_url) or _safe_ext_from_mime(mime_guess, default=".pdf")
            if not ext.startswith("."):
                ext = "." + ext

            tmp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")
            _stream_download(file_url, tmp_path)

        # --- Run your OCR/extractor on tmp_path ---
        print(f"🔄 Running OCR extraction on file: {tmp_path}")
        result = OCR(tmp_path)  # pass file_format if useful
        print("✅ OCR extraction completed")
        print(f"📊 Result type: {type(result).__name__}")
        return result

    except HTTPException as http_error:
        # Propagate FastAPI HTTPExceptions as-is
        print(f"🚫 HTTP Exception in extract_file: {http_error.detail}")
        raise

    except Exception as e:
        # Generic error envelope
        print(f"💥 Unexpected error in extract_file: {str(e)}")
        print(f"🔍 Error type: {type(e).__name__}")
        return {"error": str(e)}

    finally:
        # Cleanup
        try:
            if tmp_path and os.path.exists(tmp_path):
                print(f"🧹 Cleaning up temporary file: {tmp_path}")
                os.remove(tmp_path)
                print("✅ Temporary file cleaned up")
        except Exception as cleanup_error:
            print(f"⚠️ Failed to cleanup temporary file: {cleanup_error}")
            pass


def normalize_schema(schema):
    """Normalize JSON schema for OpenAI structured outputs"""
    print(f"🔧 Normalizing schema...")
    if not schema:
        print("📋 No schema provided")
        return schema
    
    print(f"📋 Schema type: {schema.get('type', 'undefined')}")
    print(f"📋 Schema keys: {list(schema.keys())}")
    
    # shallow clone is fine here; deepen if you plan nested strictness
    copy = dict(schema)
    if copy.get("type") == "object" and "additionalProperties" not in copy:
        copy["additionalProperties"] = False
        print("🔧 Added additionalProperties: false")
    
    print("✅ Schema normalization completed")
    return copy


def parse_pi_assessment(resp, schema):    
    text = None
    print("🔍 Attempting to extract text from response...")
    if hasattr(resp, 'output_text'):
        text = resp.output_text
        print("✅ Found text via output_text attribute")
    elif hasattr(resp, 'output') and resp.output:
        print("🔍 Searching through output array...")
        for i, item in enumerate(resp.output):
            print(f"  - Checking output item {i}")
            if hasattr(item, 'content') and item.content:
                for j, content in enumerate(item.content):
                    print(f"    - Checking content item {j}")
                    if hasattr(content, 'text'):
                        text = content.text
                        print("✅ Found text via output.content.text")
                        break
                    elif hasattr(content, 'output_text'):
                        text = content.output_text
                        print("✅ Found text via output.content.output_text")
                        break
                if text:
                    break
    elif hasattr(resp, 'choices') and resp.choices:
        text = resp.choices[0].message.content
        print("✅ Found text via choices[0].message.content")
    
    if not text:
        print("❌ Could not extract text from response")
        print(f"🔍 Response attributes: {dir(resp)}")
        raise HTTPException(status_code=500, detail="Could not find model JSON in response")

    print(f"📝 Extracted text length: {len(text)} characters")
    print(f"📝 Text preview: {text[:200]}...")

    # Parse JSON
    print("🔄 Attempting to parse JSON...")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing failed: {e}")
        print(f"📝 Raw text that failed to parse: {text}")
        raise HTTPException(status_code=500, detail="Model output was not valid JSON")

    return data


@app.post("/ai/invoke")
def invoke_llm(payload: dict = Body(...)):
    """Backend endpoint for LLM invocation"""
    print("🚀 /ai/invoke endpoint called")
    print(f"📨 Received payload keys: {list(payload.keys())}")
    
    # Check if OpenAI client is available
    if openai_client is None:
        print("❌ Error: OpenAI client not initialized (missing API key)")
        raise HTTPException(status_code=500, detail="OpenAI API not configured")
    
    try:
        prompt = payload.get("prompt")
        add_context_from_internet = payload.get("add_context_from_internet", False)
        response_json_schema = payload.get("response_json_schema")
        file_urls = payload.get("file_urls")
        
        print(f"🔍 Extracted parameters:")
        print(f"  - Prompt length: {len(prompt) if prompt else 0} characters")
        print(f"  - Context from internet: {add_context_from_internet}")
        print(f"  - Has schema: {response_json_schema is not None}")
        print(f"  - File URLs: {file_urls}")
        
        if not prompt:
            print("❌ Error: No prompt provided")
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # If we have a schema, use structured outputs
        if response_json_schema:
            print("🔧 Using structured outputs with schema")
            normalized_schema = normalize_schema(response_json_schema)
            print(f"📋 Normalized schema keys: {list(normalized_schema.keys()) if normalized_schema else None}")
            
            try:
                print("🤖 Attempting OpenAI Responses API call...")
                # Try using the responses API for structured outputs
                resp = openai_client.responses.create(
                    model="gpt-5",
                    reasoning={"effort": "medium"},
                    input=[
                        {
                            "role": "system",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": "Return your answer strictly as JSON that matches the provided schema. "
                                           "No prose outside JSON.",
                                }
                            ],
                        },
                        {
                            "role": "user",
                            "content": [{"type": "input_text", "text": prompt}],
                        },
                    ],
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "assessment_response",
                            "schema": normalized_schema,
                            "strict": False
                        },
                    },
                )
                
                print("✅ OpenAI Responses API call successful")
                
                result = parse_pi_assessment(resp, normalized_schema)
                print("✅ Successfully parsed PI assessment")
                print(f"📊 Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
                
                response_data = {
                    "data": {
                        "message": result,
                    }
                }
                print("🎯 Returning structured response")
                return response_data
                
            except Exception as e:
                # Fall back to regular chat completion if responses API fails
                print(f"⚠️ Responses API failed, falling back to chat completion: {e}")
                print("🤖 Attempting OpenAI Chat Completion API call...")
                
                response = openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful assistant. Return your response as JSON if a schema is provided."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    response_format={"type": "json_object"} if response_json_schema else None
                )
                
                print("✅ OpenAI Chat Completion API call successful")
                content = response.choices[0].message.content
                print(f"📝 Received content length: {len(content)} characters")
                
                try:
                    print("🔄 Attempting to parse JSON response...")
                    parsed_content = json.loads(content) if response_json_schema else content
                    print("✅ Successfully parsed JSON")
                    
                    response_data = {
                        "data": {
                            "message": parsed_content,
                        }
                    }
                    print("🎯 Returning fallback structured response")
                    return response_data
                except json.JSONDecodeError as json_error:
                    print(f"⚠️ JSON parsing failed: {json_error}")
                    print("📝 Returning raw content")
                    return {
                        "data": {
                            "message": content,
                        }
                    }
        else:
            print("💬 Using regular text response (no schema)")
            print("🤖 Making OpenAI Chat Completion API call...")
            
            # Regular text response
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            print("✅ OpenAI API call successful")
            content = response.choices[0].message.content
            print(f"📝 Received response length: {len(content)} characters")
            
            response_data = {
                "response": content
            }
            print("🎯 Returning text response")
            return response_data
            
    except HTTPException as http_error:
        print(f"🚫 HTTP Exception: {http_error.detail}")
        raise
    except Exception as e:
        print(f"💥 Unexpected error in LLM invocation: {str(e)}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"LLM invocation failed: {str(e)}")


@app.post("/ai/generate-image")
def generate_image(payload: dict = Body(...)):
    """Backend endpoint for image generation"""
    print("🎨 /ai/generate-image endpoint called")
    print(f"📨 Received payload keys: {list(payload.keys())}")
    
    # Check if OpenAI client is available
    if openai_client is None:
        print("❌ Error: OpenAI client not initialized (missing API key)")
        raise HTTPException(status_code=500, detail="OpenAI API not configured")
    
    try:
        prompt = payload.get("prompt")
        
        print(f"🔍 Extracted parameters:")
        print(f"  - Prompt length: {len(prompt) if prompt else 0} characters")
        print(f"  - Prompt preview: {prompt[:100] if prompt else 'None'}...")
        
        if not prompt:
            print("❌ Error: No prompt provided")
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        print("🤖 Making OpenAI DALL-E API call...")
        print("  - Model: dall-e-3")
        print("  - Size: 1024x1024")
        print("  - Quality: standard")
        
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        
        print("✅ OpenAI DALL-E API call successful")
        image_url = response.data[0].url
        print(f"🖼️ Generated image URL: {image_url[:50]}...")
        
        response_data = {"url": image_url}
        print("🎯 Returning image response")
        return response_data
        
    except HTTPException as http_error:
        print(f"🚫 HTTP Exception: {http_error.detail}")
        raise
    except Exception as e:
        print(f"💥 Unexpected error in image generation: {str(e)}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


if __name__ == "__main__":
    print("🚀 Starting Nometria Backend Server...")
    print("🌐 Host: 0.0.0.0")
    print("🔌 Port: 9080")
    print("📡 CORS enabled for local development")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=9080)
