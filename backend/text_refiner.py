import re
import difflib
from typing import Dict, List, Tuple, Optional, Any, Set
from collections import Counter
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class TextRefinementResult:
    original_text: str
    refined_text: str
    corrections_made: List[str]
    confidence_improvement: float
    word_corrections: int
    character_corrections: int

class TextRefiner:
    """Advanced text refinement system for OCR results."""
    
    def __init__(self):
        self._similarity_cache = {}
        
    def refine_multiple_ocr_results(self, ocr_results: List[Dict[str, Any]]) -> str:
        """
        Fuse multiple OCR results to create the best possible text.
        Uses advanced ensemble techniques and cross-validation.
        """
        if not ocr_results:
            return ""
        
        if len(ocr_results) == 1:
            return self.refine_single_text(ocr_results[0]['text'])
        
        # Step 1: Extract texts and confidences
        texts = [result['text'] for result in ocr_results]
        confidences = [result.get('confidence', 0.5) for result in ocr_results]
        
        # Step 2: Perform word-level fusion
        fused_text = self._perform_word_level_fusion(texts, confidences)
        
        refined_text = self.refine_single_text(fused_text)
        
        return refined_text
    
    def _perform_word_level_fusion(self, texts: List[str], confidences: List[float]) -> str:
        """Perform intelligent word-level fusion of multiple OCR results."""
        
        # Tokenize all texts into words
        word_lists = [text.split() for text in texts]
        
        # Find the longest sequence as base
        base_words = max(word_lists, key=len)
        fused_words = []
        
        for i in range(len(base_words)):
            candidates = []
            
            # Collect word candidates from all OCR results
            for j, words in enumerate(word_lists):
                if i < len(words):
                    candidates.append({
                        'word': words[i],
                        'confidence': confidences[j],
                        'source': j
                    })
            
            if candidates:
                # Choose best word using multiple criteria
                best_word = self._select_best_word_candidate(candidates)
                fused_words.append(best_word)
            else:
                fused_words.append(base_words[i])
        
        return ' '.join(fused_words)
    
    def _select_best_word_candidate(self, candidates: List[Dict]) -> str:
        """Select the best word from multiple candidates."""
        
        # Score each candidate
        scored_candidates = []
        
        for candidate in candidates:
            word = candidate['word']
            confidence = candidate['confidence']
            
            score = confidence * 0.4  # Base confidence score
            

            # Word quality bonus (length, alphanumeric ratio)
            if len(word) >= 3 and word.isalpha():
                score += 0.2
            
            scored_candidates.append({
                'word': word,
                'score': score
            })
        
        # Return highest scoring candidate
        best_candidate = max(scored_candidates, key=lambda x: x['score'])
        return best_candidate['word']
    
    def refine_single_text(self, text: str) -> str:
        """Comprehensively refine a single OCR text result."""
        
        if not text or not text.strip():
            return text
        
        refined_text = text
        # Step 6: Final cleanup
        refined_text = self._final_cleanup(refined_text)
        
        return refined_text
    
    
    def _should_correct_word(self, original: str, suggested: str) -> bool:
        """Determine if a word should be corrected based on similarity and context."""
        
        # Don't correct if words are too different
        similarity = difflib.SequenceMatcher(None, original, suggested).ratio()
        if similarity < 0.7:
            return False
        
        # Don't correct proper nouns (likely patient names)
        if original[0].isupper() and suggested[0].islower():
            return False
        
        # Don't correct numbers or codes
        if any(char.isdigit() for char in original):
            return False
        
        return True
    
    def _preserve_word_format(self, original: str, corrected: str) -> str:
        """Preserve the case and punctuation of the original word."""
        
        # Extract leading/trailing punctuation
        leading_punct = re.match(r'^[^\w]*', original).group()
        trailing_punct = re.search(r'[^\w]*$', original).group()
        
        # Get the core word
        core_original = re.sub(r'[^\w]', '', original)
        
        # Apply case pattern from original to corrected
        if core_original.isupper():
            corrected_core = corrected.upper()
        elif core_original.istitle():
            corrected_core = corrected.title()
        elif core_original.islower():
            corrected_core = corrected.lower()
        else:
            # Mixed case - try to preserve pattern
            corrected_core = corrected.lower()
            for i, char in enumerate(core_original):
                if i < len(corrected_core) and char.isupper():
                    corrected_core = corrected_core[:i] + corrected_core[i].upper() + corrected_core[i+1:]
        
        return leading_punct + corrected_core + trailing_punct
    
    
    def _final_cleanup(self, text: str) -> str:
        """Perform final text cleanup and formatting."""
        
        # Fix spacing issues
        text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single
        text = re.sub(r'\n+', '\n', text)  # Multiple newlines to single
        
        # Fix punctuation spacing
        text = re.sub(r'\s+([,.;:!?])', r'\1', text)  # Remove space before punctuation
        text = re.sub(r'([,.;:!?])([^\s])', r'\1 \2', text)  # Add space after punctuation
        
        # Fix number formatting
        text = re.sub(r'(\d+)\s*([mg|ml|kg|lbs])\b', r'\1 \2', text)  # Proper unit spacing
        
        text = re.sub(r'\b([A-Z]{2,})\s*:', r'\1:', text)  # Remove space before colon in abbreviations
        
        return text.strip()

# Global instance
text_refiner = TextRefiner()
