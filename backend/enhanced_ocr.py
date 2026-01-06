import os
import re
import cv2
import numpy as np
from PIL import Image
import pytesseract
import easyocr
from typing import Dict, List, Tuple, Optional, Any
import logging
from dataclasses import dataclass, asdict
from enum import Enum
import io
import time
import text_refiner
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# External API imports (optional fallback for difficult cases)
try:
    from google.cloud import vision
    logger.info("✅ Google Cloud Vision available")
except ImportError:
    vision = None
    logger.info("⚠️ Google Cloud Vision not available")

class OCREngine(Enum):
    TESSERACT = "tesseract"
    EASYOCR = "easyocr"
    GOOGLE_VISION = "google_vision"

@dataclass
class OCRResult:
    text: str
    confidence: float
    engine: str
    processing_time: float
    word_count: int
    character_count: int
    quality_score: float
    bounding_boxes: List[Dict] = None

class EnhancedOCRProcessor:
    def __init__(self):
        """Initialize the enhanced OCR processor with multiple engines."""
        self.confidence_threshold = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.7"))
        self.quality_threshold = float(os.getenv("OCR_QUALITY_THRESHOLD", "0.6"))
        
        # Initialize open-source engines
        self._init_open_source_engines()
        
        # Initialize external API clients
        self._init_external_apis()
        
    def _init_open_source_engines(self):
        """Initialize open-source OCR engines."""
        try:
            # EasyOCR - auto-detects GPU availability
            # Will use CUDA if available, otherwise CPU
            self.easyocr_reader = easyocr.Reader(['en'], gpu=False)  # Set to False for CPU, True for GPU
            logger.info("✅ EasyOCR initialized successfully")
        except Exception as e:
            logger.warning(f"❌ Failed to initialize EasyOCR: {e}")
            self.easyocr_reader = None
    
    def _init_external_apis(self):
        """Initialize external API clients (optional fallback)."""
        # Google Cloud Vision (optional, for difficult cases)
        try:
            if vision and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                self.google_client = vision.ImageAnnotatorClient()
                logger.info("✅ Google Cloud Vision initialized")
            else:
                self.google_client = None
                logger.info("⚠️ Google Cloud Vision not configured (optional)")
        except Exception as e:
            logger.warning(f"❌ Failed to initialize Google Cloud Vision: {e}")
            self.google_client = None

    def preprocess_image(self, image: Image.Image) -> List[Image.Image]:
        """
        Advanced preprocessing specifically for handwritten documents.
        Returns multiple processed versions for ensemble OCR.
        """
        # Convert PIL to cv2
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        
        processed_images = []
        
        # Version 1: Enhanced contrast and denoising (good for emergency room forms)
        enhanced = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8)).apply(gray)
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
        processed_images.append(Image.fromarray(denoised))
        
        # Version 2: Adaptive threshold (good for printed forms and checkboxes)
        adaptive = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 65, 13
        )
        processed_images.append(Image.fromarray(adaptive))
        
        # Version 3: Morphological operations (optimized for stressed handwriting in reports)
        kernel = np.ones((2,2), np.uint8)
        morph = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        # Additional processing for handwritten notes
        morph = cv2.GaussianBlur(morph, (1,1), 0)
        processed_images.append(Image.fromarray(morph))
        
        # Version 4: High resolution with sharpening (for poor quality accident scene photos/scans)
        resized = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        kernel_sharp = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(resized, -1, kernel_sharp)
        processed_images.append(Image.fromarray(sharpened))
        
        # Version 5: Specialized for insurance/legal forms (high contrast)
        # Create high contrast version for checkbox detection and form fields
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Dilate slightly to connect broken characters common in forms
        kernel_form = np.ones((1,2), np.uint8)
        form_optimized = cv2.dilate(binary, kernel_form, iterations=1)
        processed_images.append(Image.fromarray(form_optimized))
        
        # Version 6: Original with minimal processing (fallback)
        processed_images.append(image.convert('L'))
        
        return processed_images

    def calculate_text_quality(self, text: str, confidence: float = None) -> float:
        """Calculate text quality score based on various metrics, optimized for handwritten records."""
        if not text.strip():
            return 0.0
            
        quality_score = 0.0
        
        # Length factor (reasonable length gets higher score)
        length_score = min(len(text) / 100, 1.0) * 0.15
        quality_score += length_score
        
        # Word ratio (more complete words = better)
        words = text.split()
        if words:
            complete_words = sum(1 for word in words if len(word) >= 3 and word.isalpha())
            word_ratio = complete_words / len(words)
            quality_score += word_ratio * 0.25
        
        # Character variety (good OCR should have varied characters)
        unique_chars = len(set(text.lower())) / max(len(text), 1)
        quality_score += unique_chars * 0.15
        
        # Confidence score if available
        if confidence is not None:
            quality_score += confidence * 0.05  # Reduced weight, focus more on content
            
        return min(quality_score, 1.0)

    def ocr_tesseract(self, image: Image.Image) -> OCRResult:
        start_time = time.time()
        
        # Optimized for better space detection in documents
        config = """--oem 3 --psm 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,;:()[]{}/-+*=@#$%^&|<>?!"''"\s\\°× preserve_interword_spaces=1"""
        
        try:
            # Get text and confidence data
            # data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            # text = pytesseract.image_to_string(image, config=config)

            data = pytesseract.image_to_data(image,  output_type=pytesseract.Output.DICT)
            text = pytesseract.image_to_string(image)
            
            # Calculate average confidence
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            confidence = avg_confidence / 100.0
            
            processing_time = time.time() - start_time
            quality_score = self.calculate_text_quality(text, confidence)
            
            return OCRResult(
                text=text.strip(),
                confidence=confidence,
                engine="tesseract",
                processing_time=processing_time,
                word_count=len(text.split()),
                character_count=len(text),
                quality_score=quality_score
            )
            
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            return OCRResult("", 0.0, "tesseract", time.time() - start_time, 0, 0, 0.0)

    def ocr_easyocr(self, image: Image.Image) -> OCRResult:
        """EasyOCR processing with confidence extraction."""
        start_time = time.time()
        
        if not self.easyocr_reader:
            return OCRResult("", 0.0, "easyocr", time.time() - start_time, 0, 0, 0.0)
            
        try:
            # Convert PIL to numpy array
            img_array = np.array(image)
            
            # Get results with bounding boxes and confidence
            results = self.easyocr_reader.readtext(img_array, detail=1)
            
            # Extract text and calculate average confidence
            texts = []
            confidences = []
            bounding_boxes = []
            
            for (bbox, text, conf) in results:
                if conf > 0.3:  # Filter out very low confidence detections
                    texts.append(text)
                    confidences.append(conf)
                    bounding_boxes.append({
                        'bbox': bbox,
                        'text': text,
                        'confidence': conf
                    })
            
            full_text = ' '.join(texts)

            
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            processing_time = time.time() - start_time
            quality_score = self.calculate_text_quality(full_text, avg_confidence)
            
            return OCRResult(
                text=full_text,
                confidence=avg_confidence,
                engine="easyocr",
                processing_time=processing_time,
                word_count=len(full_text.split()),
                character_count=len(full_text),
                quality_score=quality_score,
                bounding_boxes=bounding_boxes
            )
            
        except Exception as e:
            logger.error(f"EasyOCR failed: {e}")
            return OCRResult("", 0.0, "easyocr", time.time() - start_time, 0, 0, 0.0)

    def ocr_google_vision(self, image: Image.Image) -> OCRResult:
        """Google Cloud Vision API OCR (optional fallback for difficult cases)."""
        start_time = time.time()
        
        if not self.google_client:
            return OCRResult("", 0.0, "google_vision", time.time() - start_time, 0, 0, 0.0)
            
        try:
            # Convert image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr = img_byte_arr.getvalue()
            
            # Create Vision API image object
            vision_image = vision.Image(content=img_byte_arr)
            
            # Perform OCR
            response = self.google_client.text_detection(image=vision_image)
            texts = response.text_annotations
            
            if texts:
                full_text = texts[0].description
                

                # Google Vision API doesn't provide per-word confidence,
                # but we can estimate based on text quality
                quality_score = self.calculate_text_quality(full_text)
                confidence = quality_score
            else:
                full_text = ""
                confidence = 0.0
                quality_score = 0.0
            
            processing_time = time.time() - start_time
            
            return OCRResult(
                text=full_text,
                confidence=confidence,
                engine="google_vision",
                processing_time=processing_time,
                word_count=len(full_text.split()) if full_text else 0,
                character_count=len(full_text) if full_text else 0,
                quality_score=quality_score
            )
            
        except Exception as e:
            logger.error(f"Google Vision OCR failed: {e}")
            return OCRResult("", 0.0, "google_vision", time.time() - start_time, 0, 0, 0.0)

    def ensemble_ocr(self, image: Image.Image, engines: List[str] = None) -> Dict[str, Any]:
        """
        Run multiple OCR engines and return the best result based on confidence and quality.
        ENHANCED: Now includes advanced text fusion and refinement.
        """
        if engines is None:
            engines = ["tesseract", "easyocr"]
        
        # Preprocess image for different engines
        processed_images = self.preprocess_image(image)
        
        results = []
        
        # Run OCR engines on different processed versions
        for engine_name in engines:
            if engine_name == "tesseract":
                for i, proc_img in enumerate(processed_images[:3]):  # Try first 3 versions
                    result = self.ocr_tesseract(proc_img)
                    result.engine = f"tesseract_v{i+1}"
                    results.append(result)
            
            elif engine_name == "easyocr" and self.easyocr_reader:
                # Try EasyOCR on 2 different preprocessed versions
                result1 = self.ocr_easyocr(processed_images[0])  # Enhanced contrast version
                results.append(result1)
                
                result2 = self.ocr_easyocr(processed_images[1])  # Adaptive threshold version
                result2.engine = "easyocr_v2"
                results.append(result2)
        
        # Filter out empty results
        valid_results = [r for r in results if r.text.strip() and r.quality_score > 0.1]
        
        if not valid_results:
            return {
                "best_result": OCRResult("", 0.0, "none", 0.0, 0, 0, 0.0),
                "all_results": results,
                "needs_external_api": True,
                "fusion_used": False
            }
        
        # ENHANCED: Perform advanced text fusion if we have multiple good results
        fusion_used = False
        if len(valid_results) >= 2:
            logger.info(f"🔀 Performing advanced text fusion on {len(valid_results)} OCR results")
            
            # Prepare results for fusion
            fusion_inputs = []
            for result in valid_results:
                fusion_inputs.append({
                    'text': result.text,
                    'confidence': result.confidence,
                    'quality_score': result.quality_score,
                    'engine': result.engine
                })
            
            # Perform text fusion and refinement
            fused_text = text_refiner.refine_multiple_ocr_results(fusion_inputs)
            
            # Create a new result representing the fused output
            if fused_text and fused_text != valid_results[0].text:
                fusion_used = True
                
                # Calculate new quality metrics for fused result
                fused_quality = self.calculate_text_quality(fused_text)
                avg_confidence = sum(r.confidence for r in valid_results) / len(valid_results)
                avg_processing_time = sum(r.processing_time for r in valid_results)
                
                fused_result = OCRResult(
                    text=fused_text,
                    confidence=min(avg_confidence * 1.1, 1.0),  # Slight bonus for fusion
                    engine="advanced_fusion",
                    processing_time=avg_processing_time,
                    word_count=len(fused_text.split()),
                    character_count=len(fused_text),
                    quality_score=fused_quality
                )
                
                logger.info(f"✨ Text fusion improved quality: {fused_quality:.3f}")
                best_result = fused_result
            else:
                # Fallback to best single result
                best_result = max(valid_results, key=lambda r: (r.quality_score * 0.7 + r.confidence * 0.3))
        else:
            best_single = max(valid_results, key=lambda r: (r.quality_score * 0.7 + r.confidence * 0.3))
            refined_text = text_refiner.refine_single_text(best_single.text)
            
            if refined_text != best_single.text:
                refined_quality = self.calculate_text_quality(refined_text)
                
                best_result = OCRResult(
                    text=refined_text,
                    confidence=min(best_single.confidence * 1.05, 1.0),  # Small bonus for refinement
                    engine=f"{best_single.engine}_refined",
                    processing_time=best_single.processing_time,
                    word_count=len(refined_text.split()),
                    character_count=len(refined_text),
                    quality_score=refined_quality
                )
                logger.info(f"🔧 Single result refined, quality: {refined_quality:.3f}")
            else:
                best_result = best_single
        
        # Determine if we need external API
        needs_external = (
            best_result.confidence < self.confidence_threshold or 
            best_result.quality_score < self.quality_threshold
        )
        
        return {
            "best_result": best_result,
            "all_results": results,
            "needs_external_api": needs_external,
            "fusion_used": fusion_used
        }

    def process_with_external_apis(self, image: Image.Image) -> OCRResult:
        """
        Use Google Cloud Vision API when open-source engines don't meet quality threshold.
        This is an optional fallback that requires GOOGLE_APPLICATION_CREDENTIALS to be set.
        """
        if self.google_client:
            try:
                result = self.ocr_google_vision(image)
                if result.text.strip():
                    logger.info(f"✅ Google Vision API returned result with quality: {result.quality_score:.2f}")
                    return result
            except Exception as e:
                logger.error(f"Google Vision API failed: {e}")
        
        # No external API available or it failed
        logger.warning("⚠️ No external API available or configured")
        return OCRResult("", 0.0, "external_api_unavailable", 0.0, 0, 0, 0.0)

    def extract_text_from_page(self, image: Image.Image) -> Dict[str, Any]:
        """
        Main method to extract text from a single page image.
        """
        logger.info(f"🔄 Starting OCR processing for image of size {image.size}")
        
        # Step 1: Try ensemble of open-source engines
        ensemble_result = self.ensemble_ocr(image)
        best_result = ensemble_result["best_result"]
        
        logger.info(f"📊 Best open-source result: {best_result.engine} "
                   f"(confidence: {best_result.confidence:.2f}, quality: {best_result.quality_score:.2f})")
        
        # Step 2: Use external APIs if needed
        used_external_api = False
        if ensemble_result["needs_external_api"]:
            logger.info("🔄 Quality below threshold, trying external API...")
            external_result = self.process_with_external_apis(image)
            
            if external_result.quality_score > best_result.quality_score:
                logger.info(f"✅ External API {external_result.engine} provided better result")
                best_result = external_result
                used_external_api = True
            else:
                logger.info("⚠️ External API didn't improve results, keeping open-source result")
        
        final_text = best_result.text
        
        
        return {
            "text": final_text,
            "confidence": best_result.confidence,
            "quality_score": best_result.quality_score,
            "engine_used": best_result.engine,
            "processing_time": best_result.processing_time,
            "word_count": len(final_text.split()),
            "character_count": len(final_text),
            "all_engine_results": [asdict(r) for r in ensemble_result["all_results"]],
            "used_external_api": used_external_api,
            "fusion_used": ensemble_result.get("fusion_used", False),
        }
# Global instance
ocr_processor = EnhancedOCRProcessor()

def extract_page_text(image: Image.Image) -> Dict[str, Any]:
    """
    Main function to extract text from a page image.
    This is the function that should be called from the main application.
    """
    return ocr_processor.extract_text_from_page(image)
