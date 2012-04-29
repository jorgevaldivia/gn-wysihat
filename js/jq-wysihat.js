/*  IE Selection and Range classes
 *
 *  Original created by Tim Cameron Ryan
 *    http://github.com/timcameronryan/IERange
 *  Copyright (c) 2009 Tim Cameron Ryan
 *  Released under the MIT/X License
 *
 *  Modified by Joshua Peek
 */

if (!window.getSelection) {
  // TODO: Move this object into a closure
  var DOMUtils = {
    isDataNode: function(node) {
      try {
        return node && node.nodeValue !== null && node.data !== null;
      } catch (e) {
        return false;
      }
    },
    isAncestorOf: function(parent, node) {
      if (!parent) return false;
      return !DOMUtils.isDataNode(parent) &&
          (parent.contains(DOMUtils.isDataNode(node) ? node.parentNode : node) ||
          node.parentNode == parent);
    },
    isAncestorOrSelf: function(root, node) {
      return DOMUtils.isAncestorOf(root, node) || root == node;
    },
    findClosestAncestor: function(root, node) {
      if (DOMUtils.isAncestorOf(root, node))
        while (node && node.parentNode != root)
          node = node.parentNode;
      return node;
    },
    getNodeLength: function(node) {
      return DOMUtils.isDataNode(node) ? node.length : node.childNodes.length;
    },
    splitDataNode: function(node, offset) {
      if (!DOMUtils.isDataNode(node))
        return false;
      var newNode = node.cloneNode(false);
      node.deleteData(offset, node.length);
      newNode.deleteData(0, offset);
      node.parentNode.insertBefore(newNode, node.nextSibling);
    }
  };

  window.Range = (function() {
    function Range(document) {
      // save document parameter
      this._document = document;

      // initialize range
      this.startContainer = this.endContainer = document.body;
      this.endOffset = DOMUtils.getNodeLength(document.body);
    }
    Range.START_TO_START = 0;
    Range.START_TO_END = 1;
    Range.END_TO_END = 2;
    Range.END_TO_START = 3;

    function findChildPosition(node) {
      for (var i = 0; node = node.previousSibling; i++)
        continue;
      return i;
    }

    Range.prototype = {
      startContainer: null,
      startOffset: 0,
      endContainer: null,
      endOffset: 0,
      commonAncestorContainer: null,
      collapsed: false,
      _document: null,

      _toTextRange: function() {
        function adoptEndPoint(textRange, domRange, bStart) {
          // find anchor node and offset
          var container = domRange[bStart ? 'startContainer' : 'endContainer'];
          var offset = domRange[bStart ? 'startOffset' : 'endOffset'], textOffset = 0;
          var anchorNode = DOMUtils.isDataNode(container) ? container : container.childNodes[offset];
          var anchorParent = DOMUtils.isDataNode(container) ? container.parentNode : container;

          // visible data nodes need a text offset
          if (container.nodeType == 3 || container.nodeType == 4)
            textOffset = offset;

          // create a cursor element node to position range (since we can't select text nodes)
          var cursorNode = domRange._document.createElement('a');
          if (anchorNode)
            anchorParent.insertBefore(cursorNode, anchorNode);
          else
            anchorParent.appendChild(cursorNode);
          var cursor = domRange._document.body.createTextRange();
          cursor.moveToElementText(cursorNode);
          cursorNode.parentNode.removeChild(cursorNode);

          // move range
          textRange.setEndPoint(bStart ? 'StartToStart' : 'EndToStart', cursor);
          textRange[bStart ? 'moveStart' : 'moveEnd']('character', textOffset);
        }

        // return an IE text range
        var textRange = this._document.body.createTextRange();
        adoptEndPoint(textRange, this, true);
        adoptEndPoint(textRange, this, false);
        return textRange;
      },

      _refreshProperties: function() {
        // collapsed attribute
        this.collapsed = (this.startContainer == this.endContainer && this.startOffset == this.endOffset);
        // find common ancestor
        var node = this.startContainer;
        while (node && node != this.endContainer && !DOMUtils.isAncestorOf(node, this.endContainer))
          node = node.parentNode;
        this.commonAncestorContainer = node;
      },

      setStart: function(container, offset) {
        this.startContainer = container;
        this.startOffset = offset;
        this._refreshProperties();
      },
      setEnd: function(container, offset) {
        this.endContainer = container;
        this.endOffset = offset;
        this._refreshProperties();
      },
      setStartBefore: function(refNode) {
        // set start to beore this node
        this.setStart(refNode.parentNode, findChildPosition(refNode));
      },
      setStartAfter: function(refNode) {
        // select next sibling
        this.setStart(refNode.parentNode, findChildPosition(refNode) + 1);
      },
      setEndBefore: function(refNode) {
        // set end to beore this node
        this.setEnd(refNode.parentNode, findChildPosition(refNode));
      },
      setEndAfter: function(refNode) {
        // select next sibling
        this.setEnd(refNode.parentNode, findChildPosition(refNode) + 1);
      },
      selectNode: function(refNode) {
        this.setStartBefore(refNode);
        this.setEndAfter(refNode);
      },
      selectNodeContents: function(refNode) {
        this.setStart(refNode, 0);
        this.setEnd(refNode, DOMUtils.getNodeLength(refNode));
      },
      collapse: function(toStart) {
        if (toStart)
          this.setEnd(this.startContainer, this.startOffset);
        else
          this.setStart(this.endContainer, this.endOffset);
      },

      cloneContents: function() {
        // clone subtree
        return (function cloneSubtree(iterator) {
          for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
            node = node.cloneNode(!iterator.hasPartialSubtree());
            if (iterator.hasPartialSubtree())
              node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
            frag.appendChild(node);
          }
          return frag;
        })(new RangeIterator(this));
      },
      extractContents: function() {
        // cache range and move anchor points
        var range = this.cloneRange();
        if (this.startContainer != this.commonAncestorContainer)
          this.setStartAfter(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.startContainer));
        this.collapse(true);
        // extract range
        return (function extractSubtree(iterator) {
          for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
            iterator.hasPartialSubtree() ? node = node.cloneNode(false) : iterator.remove();
            if (iterator.hasPartialSubtree())
              node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
            frag.appendChild(node);
          }
          return frag;
        })(new RangeIterator(range));
      },
      deleteContents: function() {
        // cache range and move anchor points
        var range = this.cloneRange();
        if (this.startContainer != this.commonAncestorContainer)
          this.setStartAfter(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.startContainer));
        this.collapse(true);
        // delete range
        (function deleteSubtree(iterator) {
          while (iterator.next())
            iterator.hasPartialSubtree() ? deleteSubtree(iterator.getSubtreeIterator()) : iterator.remove();
        })(new RangeIterator(range));
      },
      insertNode: function(newNode) {
        // set original anchor and insert node
        if (DOMUtils.isDataNode(this.startContainer)) {
          DOMUtils.splitDataNode(this.startContainer, this.startOffset);
          this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
        } else {
          var offsetNode = this.startContainer.childNodes[this.startOffset];
          if (offsetNode) {
            this.startContainer.insertBefore(newNode, offsetNode);
          } else {
            this.startContainer.appendChild(newNode);
          }
        }
        // resync start anchor
        this.setStart(this.startContainer, this.startOffset);
      },
      surroundContents: function(newNode) {
        // extract and surround contents
        var content = this.extractContents();
        this.insertNode(newNode);
        newNode.appendChild(content);
        this.selectNode(newNode);
      },

      compareBoundaryPoints: function(how, sourceRange) {
        // get anchors
        var containerA, offsetA, containerB, offsetB;
        switch (how) {
            case Range.START_TO_START:
            case Range.START_TO_END:
          containerA = this.startContainer;
          offsetA = this.startOffset;
          break;
            case Range.END_TO_END:
            case Range.END_TO_START:
          containerA = this.endContainer;
          offsetA = this.endOffset;
          break;
        }
        switch (how) {
            case Range.START_TO_START:
            case Range.END_TO_START:
          containerB = sourceRange.startContainer;
          offsetB = sourceRange.startOffset;
          break;
            case Range.START_TO_END:
            case Range.END_TO_END:
          containerB = sourceRange.endContainer;
          offsetB = sourceRange.endOffset;
          break;
        }

        // compare
        return containerA.sourceIndex < containerB.sourceIndex ? -1 :
            containerA.sourceIndex == containerB.sourceIndex ?
                offsetA < offsetB ? -1 : offsetA == offsetB ? 0 : 1
                : 1;
      },
      cloneRange: function() {
        // return cloned range
        var range = new Range(this._document);
        range.setStart(this.startContainer, this.startOffset);
        range.setEnd(this.endContainer, this.endOffset);
        return range;
      },
      detach: function() {
      },
      toString: function() {
        return this._toTextRange().text;
      },
      createContextualFragment: function(tagString) {
        // parse the tag string in a context node
        var content = (DOMUtils.isDataNode(this.startContainer) ? this.startContainer.parentNode : this.startContainer).cloneNode(false);
        content.innerHTML = tagString;
        // return a document fragment from the created node
        for (var fragment = this._document.createDocumentFragment(); content.firstChild; )
          fragment.appendChild(content.firstChild);
        return fragment;
      }
    };

    function RangeIterator(range) {
      this.range = range;
      if (range.collapsed)
        return;

      // get anchors
      var root = range.commonAncestorContainer;
      this._next = range.startContainer == root && !DOMUtils.isDataNode(range.startContainer) ?
          range.startContainer.childNodes[range.startOffset] :
          DOMUtils.findClosestAncestor(root, range.startContainer);
      this._end = range.endContainer == root && !DOMUtils.isDataNode(range.endContainer) ?
          range.endContainer.childNodes[range.endOffset] :
          DOMUtils.findClosestAncestor(root, range.endContainer).nextSibling;
    }

    RangeIterator.prototype = {
      range: null,
      _current: null,
      _next: null,
      _end: null,

      hasNext: function() {
        return !!this._next;
      },
      next: function() {
        // move to next node
        var current = this._current = this._next;
        this._next = this._current && this._current.nextSibling != this._end ?
            this._current.nextSibling : null;

        // check for partial text nodes
        if (DOMUtils.isDataNode(this._current)) {
          if (this.range.endContainer == this._current)
            (current = current.cloneNode(true)).deleteData(this.range.endOffset, current.length - this.range.endOffset);
          if (this.range.startContainer == this._current)
            (current = current.cloneNode(true)).deleteData(0, this.range.startOffset);
        }
        return current;
      },
      remove: function() {
        // check for partial text nodes
        if (DOMUtils.isDataNode(this._current) &&
            (this.range.startContainer == this._current || this.range.endContainer == this._current)) {
          var start = this.range.startContainer == this._current ? this.range.startOffset : 0;
          var end = this.range.endContainer == this._current ? this.range.endOffset : this._current.length;
          this._current.deleteData(start, end - start);
        } else
          this._current.parentNode.removeChild(this._current);
      },
      hasPartialSubtree: function() {
        // check if this node be partially selected
        return !DOMUtils.isDataNode(this._current) &&
            (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer) ||
                DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer));
      },
      getSubtreeIterator: function() {
        // create a new range
        var subRange = new Range(this.range._document);
        subRange.selectNodeContents(this._current);
        // handle anchor points
        if (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer))
          subRange.setStart(this.range.startContainer, this.range.startOffset);
        if (DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer))
          subRange.setEnd(this.range.endContainer, this.range.endOffset);
        // return iterator
        return new RangeIterator(subRange);
      }
    };

    return Range;
  })();

  window.Range._fromTextRange = function(textRange, document) {
    function adoptBoundary(domRange, textRange, bStart) {
      // iterate backwards through parent element to find anchor location
      var cursorNode = document.createElement('a'), cursor = textRange.duplicate();
      cursor.collapse(bStart);
      var parent = cursor.parentElement();
      do {
        parent.insertBefore(cursorNode, cursorNode.previousSibling);
        cursor.moveToElementText(cursorNode);
      } while (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) > 0 && cursorNode.previousSibling);

      // when we exceed or meet the cursor, we've found the node
      if (cursor.compareEndPoints(bStart ? 'StartToStart' : 'StartToEnd', textRange) == -1 && cursorNode.nextSibling) {
        // data node
        cursor.setEndPoint(bStart ? 'EndToStart' : 'EndToEnd', textRange);
        domRange[bStart ? 'setStart' : 'setEnd'](cursorNode.nextSibling, cursor.text.length);
      } else {
        // element
        domRange[bStart ? 'setStartBefore' : 'setEndBefore'](cursorNode);
      }
      cursorNode.parentNode.removeChild(cursorNode);
    }

    // return a DOM range
    var domRange = new Range(document);
    adoptBoundary(domRange, textRange, true);
    adoptBoundary(domRange, textRange, false);
    return domRange;
  }

  document.createRange = function() {
    return new Range(document);
  };

  window.Selection = (function() {
    function Selection(document) {
      this._document = document;

      var selection = this;
      document.attachEvent('onselectionchange', function() {
        selection._selectionChangeHandler();
      });
    }

    Selection.prototype = {
      rangeCount: 0,
      _document: null,

      _selectionChangeHandler: function() {
        this.rangeCount = this._selectionExists(this._document.selection.createRange()) ? 1 : 0;
      },
      _selectionExists: function(textRange) {
        return textRange.compareEndPoints('StartToEnd', textRange) != 0 ||
            textRange.parentElement().isContentEditable;
      },
      addRange: function(range) {
        var selection = this._document.selection.createRange(), textRange = range._toTextRange();
        if (!this._selectionExists(selection)) {
          textRange.select();
        } else {
          // only modify range if it intersects with current range
          if (textRange.compareEndPoints('StartToStart', selection) == -1)
            if (textRange.compareEndPoints('StartToEnd', selection) > -1 &&
                textRange.compareEndPoints('EndToEnd', selection) == -1)
              selection.setEndPoint('StartToStart', textRange);
          else
            if (textRange.compareEndPoints('EndToStart', selection) < 1 &&
                textRange.compareEndPoints('EndToEnd', selection) > -1)
              selection.setEndPoint('EndToEnd', textRange);
          selection.select();
        }
      },
      removeAllRanges: function() {
        this._document.selection.empty();
      },
      getRangeAt: function(index) {
        var textRange = this._document.selection.createRange();
        if (this._selectionExists(textRange))
          return Range._fromTextRange(textRange, this._document);
        return null;
      },
      toString: function() {
        return this._document.selection.createRange().text;
      }
    };

    return Selection;
  })();

  window.getSelection = (function() {
    var selection = new Selection(document);
    return function() { return selection; };
  })();
}
;

jQuery.extend(Range.prototype, (function() {
  function beforeRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == -1 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == -1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == -1 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == -1);
  }

  function afterRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == 1 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == 1);
  }

  function betweenRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return !(this.beforeRange(range) || this.afterRange(range));
  }

  function equalRange(range) {
    if (!range || !range.compareBoundaryPoints) return false;
    return (this.compareBoundaryPoints(this.START_TO_START, range) == 0 &&
      this.compareBoundaryPoints(this.START_TO_END, range) == 1 &&
      this.compareBoundaryPoints(this.END_TO_END, range) == 0 &&
      this.compareBoundaryPoints(this.END_TO_START, range) == -1);
  }

  function getNode() {
    var parent = this.commonAncestorContainer;

    while (parent.nodeType == Node.TEXT_NODE)
      parent = parent.parentNode;

    var child; 
    var that = this;
    $.each(parent.children, function(index, child) {
      var range = document.createRange();
      range.selectNodeContents(child);
      child = that.betweenRange(range);
    });

    return $(child || parent);
  }

  return {
    beforeRange:  beforeRange,
    afterRange:   afterRange,
    betweenRange: betweenRange,
    equalRange:   equalRange,
    getNode:      getNode
  };
})());

if (jQuery.browser.msie && jQuery.browser.version < 9.0) {
  jQuery.extend(Selection.prototype, (function() {
    // TODO: More robust getNode
    function getNode() {
      var range = this._document.selection.createRange();
      return jQuery(range.parentElement());
    }

    // TODO: IE selectNode should work with range.selectNode
    function selectNode(element) {
      var range = this._document.body.createTextRange();
      range.moveToElementText(element);
      range.select();
    }

    return {
      getNode:    getNode,
      selectNode: selectNode
    }
  })());
} else {
  // WebKit does not have a public Selection prototype
  if (typeof Selection == 'undefined') {
    var Selection = {}
    Selection.prototype = window.getSelection().__proto__;
  }

  jQuery.extend(Selection.prototype, (function() {
    function getNode() {
      if (this.rangeCount > 0)
        return this.getRangeAt(0).getNode();
      else
        return null;
    }

    function selectNode(element) {
      var range = document.createRange();
      range.selectNode(element[0]);
      this.removeAllRanges();
      this.addRange(range);
    }

    return {
      getNode:    getNode,
      selectNode: selectNode
    }
  })());
}
;

if (jQuery.browser.msie) {
  jQuery.extend(Selection.prototype, (function() {
    function setBookmark() {
      var bookmark = jQuery('#bookmark');
      if (bookmark) bookmark.remove();

      bookmark = jQuery('<span id="bookmark">&nbsp;</span>');
      var parent = jQuery('<div></div>').html(bookmark);

      var range = this._document.selection.createRange();
      range.collapse();
      range.pasteHTML(parent.html());
    }

    function moveToBookmark() {
      var bookmark = jQuery('#bookmark');
      if (!bookmark) return;

      var range = this._document.selection.createRange();
      range.moveToElementText(bookmark);
      range.collapse();
      range.select();

      bookmark.remove();
    }

    return {
      setBookmark:    setBookmark,
      moveToBookmark: moveToBookmark
    }
  })());
} else {
  jQuery.extend(Selection.prototype, (function() {
    function setBookmark() {
      var bookmark = jQuery('#bookmark');
      if (bookmark) bookmark.remove();

      bookmark = jQuery('<span id="bookmark">&nbsp;</span>');
      this.getRangeAt(0).insertNode(bookmark);
    }

    function moveToBookmark() {
      var bookmark = jQuery('#bookmark');
      if (!bookmark) return;

      var range = document.createRange();
      range.setStartBefore(bookmark);
      this.removeAllRanges();
      this.addRange(range);

      bookmark.remove();
    }

    return {
      setBookmark:    setBookmark,
      moveToBookmark: moveToBookmark
    }
  })());
}
;
/*  WysiHat - WYSIWYG JavaScript framework, version 0.2.1
 *  (c) 2008-2010 Joshua Peek
 *  JQ-WysiHat - jQuery port of WysiHat to run on jQuery
 *  (c) 2010 Scott Williams
 *
 *  WysiHat is freely distributable under the terms of an MIT-style license.
 *--------------------------------------------------------------------------*/

/**
 * == wysihat ==
**/

/** section: wysihat
 * WysiHat
**/

var WysiHat = {};

(function($) {
;
/** section: wysihat
 * WysiHat.Editor
**/

WysiHat.Editor = {
  /** section: wysihat
   *  WysiHat.Editor.attach(textarea) -> undefined
   *  - $textarea (jQuery): a jQuery wrapped textarea that you want to convert 
   * to a rich-text field.
   *
   *  Creates a new editor for the textarea.
  **/
  attach: function($textarea) {
    var id = $textarea.attr('id') + '_editor';
    var $editArea = $textarea.siblings('#' + id).first();

    if ($editArea.length == 0) {
      $editArea = $('<div id="' + id + '" class="editor" contentEditable="true"></div>');

      $textarea.before($editArea);
    }

    $editArea.html(WysiHat.Formatting.getBrowserMarkupFrom($textarea.val()));

    jQuery.extend($editArea, WysiHat.Commands);

    $textarea.hide();

    $textarea.closest('form').submit(function() {
      $textarea.val(WysiHat.Formatting.getApplicationMarkupFrom($editArea));
    });

    // WysiHat.BrowserFeatures.run()

    return $editArea;
  }
};
WysiHat.BrowserFeatures = (function() {
  function createTmpIframe(callback) {
    var frame, frameDocument;

    frame = $('<iframe></iframe>');
    frame.css({
      position: 'absolute',
      left: '-1000px'
    });

    frame.onFrameLoaded(function() {
      if (typeof frame.contentDocument !== 'undefined') {
        frameDocument = frame.contentDocument;
      } else if (typeof frame.contentWindow !== 'undefined' && typeof frame.contentWindow.document !== 'undefined') {
        frameDocument = frame.contentWindow.document;
      }

      frameDocument.designMode = 'on';

      callback(frameDocument);

      frame.remove();
    });

    $(document.body).insert(frame);
  }

  var features = {};

  function detectParagraphType(document) {
    document.body.innerHTML = '';
    document.execCommand('insertparagraph', false, null);

    var tagName;
    element = document.body.childNodes[0];
    if (element && element.tagName)
      tagName = element.tagName.toLowerCase();

    if (tagName == 'div')
      features.paragraphType = "div";
    else if (document.body.innerHTML == "<p><br></p>")
      features.paragraphType = "br";
    else
      features.paragraphType = "p";
  }

  function detectIndentType(document) {
    document.body.innerHTML = 'tab';
    document.execCommand('indent', false, null);

    var tagName;
    element = document.body.childNodes[0];
    if (element && element.tagName)
      tagName = element.tagName.toLowerCase();
    features.indentInsertsBlockquote = (tagName == 'blockquote');
  }

  features.run = function run() {
    if (features.finished) return;

    createTmpIframe(function(document) {
      detectParagraphType(document);
      detectIndentType(document);

      features.finished = true;
    });
  }

  return features;
})();
$(document).ready(function() {
  function fieldChangeHandler(event, element) {
    var $element = $(element);
    element = $element.get(0);
    var value;

    if ($element.attr('contentEditable') === 'true') {
      value = $element.html();
    }
    value = $element.val();

    // TODO: where did previousValue come from? Guessing it's with contentEditable
    if (value && element.previousValue != value) {
      $element.trigger("field:change");
      element.previousValue = value;
    }
  }

  $('input,textarea,*[contenteditable=""],*[contenteditable=true]').keyup(fieldChangeHandler);
});

/** section: wysihat
 *  mixin WysiHat.Commands
 *
 *  Methods will be mixed into the editor element. Most of these
 *  methods will be used to bind to button clicks or key presses.
 *
 *  var editor = WysiHat.Editor.attach(textarea);
 *  $('#bold_button').click(function(event) {
 *    editor.boldSelection();
 *    return false;
 *  });
 *
 *  In this example, it is important to stop the click event so you don't
 *  lose your current selection.
**/

WysiHat.Commands = (function(window) {
  
  /**
   *  WysiHat.Commands#boldSelection() -> undefined
   *
   *  Bolds the current selection.
  **/
  function boldSelection() {
    this.execCommand('bold', false, null);
  }

  /**
   *  WysiHat.Commands#boldSelected() -> boolean
   *
   *  Check if current selection is bold or strong.
  **/
  function boldSelected() {
    return this.queryCommandState('bold');
  }

  /**
   *  WysiHat.Commands#underlineSelection() -> undefined
   *
   *  Underlines the current selection.
  **/
  function underlineSelection() {
    this.execCommand('underline', false, null);
  }

  /**
   *  WysiHat.Commands#underlineSelected() -> boolean
   *
   *  Check if current selection is underlined.
  **/
  function underlineSelected() {
    return this.queryCommandState('underline');
  }

  /**
   *  WysiHat.Commands#italicSelection() -> undefined
   *
   *  Italicizes the current selection.
  **/
  function italicSelection() {
    this.execCommand('italic', false, null);
  }

  /**
   *  WysiHat.Commands#italicSelected() -> boolean
   *
   *  Check if current selection is italic or emphasized.
  **/
  function italicSelected() {
    return this.queryCommandState('italic');
  }

  /**
   *  WysiHat.Commands#italicSelection() -> undefined
   *
   *  Strikethroughs the current selection.
  **/
  function strikethroughSelection() {
    this.execCommand('strikethrough', false, null);
  }

  /**
   *  WysiHat.Commands#indentSelection() -> undefined
   *
   *  Indents the current selection.
  **/
  function indentSelection() {
    // TODO: Should use feature detection
    if ($.browser.mozilla && false) {
      var selection, range, node, blockquote;

      selection = window.getSelection();
      range     = selection.getRangeAt(0);
      node      = selection.getNode();

      if (range.collapsed) {
        range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      blockquote = $('<blockquote></blockquote>');
      range = selection.getRangeAt(0);
      range.surroundContents(blockquote);
    } else {
      this.execCommand('indent', false, null);
    }
  }

  /**
   *  WysiHat.Commands#outdentSelection() -> undefined
   *
   *  Outdents the current selection.
  **/
  function outdentSelection() {
    this.execCommand('outdent', false, null);
  }

  /**
   *  WysiHat.Commands#toggleIndentation() -> undefined
   *
   *  Toggles indentation the current selection.
  **/
  function toggleIndentation() {
    if (this.indentSelected()) {
      this.outdentSelection();
    } else {
      this.indentSelection();
    }
  }

  /**
   *  WysiHat.Commands#indentSelected() -> boolean
   *
   *  Check if current selection is indented.
  **/
  function indentSelected() {
    var node = window.getSelection().getNode();
    return node.is("blockquote, blockquote *");
  }

  /**
   * WysiHat.Commands#fontSelection(font) -> undefined
   *
   * Sets the font for the current selection
  **/
  function fontSelection(font) {
    this.execCommand('fontname', false, font);
  }

  /**
   * WysiHat.Commands#fontSizeSelection(fontSize) -> undefined
   * - font size (int) : font size for selection
   *
   * Sets the font size for the current selection
  **/
  function fontSizeSelection(fontSize) {
    this.execCommand('fontsize', false, fontSize);
  }

  /**
   *  WysiHat.Commands#colorSelection(color) -> undefined
   *  - color (String): a color name or hexadecimal value
   *
   *  Sets the foreground color of the current selection.
  **/
  function colorSelection(color) {
    this.execCommand('forecolor', false, color);
  }

  /**
   *  WysiHat.Commands#backgroundColorSelection(color) -> undefined
   *  - color (string) - a color or hexadecimal value
   *
   * Sets the background color.  Firefox will fill in the background
   * color of the entire iframe unless hilitecolor is used.
  **/
  function backgroundColorSelection(color) {
    if($.browser.mozilla) {
      // TODO: for some reason, hilitecolor isn't working.
      this.execCommand('hilitecolor', false, color);
    } else {
      this.execCommand('backcolor', false, color);
    }
  }

  /**
   *  WysiHat.Commands#alignSelection(color) -> undefined
   *  - alignment (string) - how the text should be aligned (left, center, right)
   *
  **/
  function alignSelection(alignment) {
    this.execCommand('justify' + alignment);
  }

  /**
   *  WysiHat.Commands#backgroundColorSelected() -> alignment
   *
   *  Returns the alignment of the selected text area
  **/
  function alignSelected() {
    var node = window.getSelection().getNode();
    return $(node).css('textAlign');
  }

  /**
   *  WysiHat.Commands#linkSelection(url) -> undefined
   *  - url (String): value for href
   *
   *  Wraps the current selection in a link.
  **/
  function linkSelection(url) {
    this.execCommand('createLink', false, url);
  }

  /**
   *  WysiHat.Commands#unlinkSelection() -> undefined
   *
   *  Selects the entire link at the cursor and removes it
  **/
  function unlinkSelection() {
    var node = window.getSelection().getNode();
    if (this.linkSelected())
      window.getSelection().selectNode(node);

    this.execCommand('unlink', false, null);
  }

  /**
   *  WysiHat.Commands#linkSelected() -> boolean
   *
   *  Check if current selection is link.
  **/
  function linkSelected() {
    var node = window.getSelection().getNode();
    return node ? node.get(0).tagName.toUpperCase() == 'A' : false;
  }

  /**
   *  WysiHat.Commands#formatblockSelection(element) -> undefined
   *  - element (String): the type of element you want to wrap your selection
   *    with (like 'h1' or 'p').
   *
   *  Wraps the current selection in a header or paragraph.
  **/
  function formatblockSelection(element){
    this.execCommand('formatblock', false, element);
  }

  /**
   *  WysiHat.Commands#toggleOrderedList() -> undefined
   *
   *  Formats current selection as an ordered list. If the selection is empty
   *  a new list is inserted.
   *
   *  If the selection is already a ordered list, the entire list
   *  will be toggled. However, toggling the last item of the list
   *  will only affect that item, not the entire list.
  **/
  function toggleOrderedList() {
    var selection, node;

    selection = window.getSelection();
    node      = selection.getNode();

    if (this.orderedListSelected() && !node.is("ol li:last-child, ol li:last-child *")) {
      selection.selectNode(node.parent("ol"));
    } else if (this.unorderedListSelected()) {
      // Toggle list type
      selection.selectNode(node.parent("ul"));
    }

    this.execCommand('insertorderedlist', false, null);
  }

  /**
   *  WysiHat.Commands#insertOrderedList() -> undefined
   *
   *  Alias for WysiHat.Commands#toggleOrderedList
  **/
  function insertOrderedList() {
    this.toggleOrderedList();
  }

  /**
   *  WysiHat.Commands#orderedListSelected() -> boolean
   *
   *  Check if current selection is within an ordered list.
  **/
  function orderedListSelected() {
    var element = window.getSelection().getNode();
    if (element) return element.is('*[contenteditable=""] ol, *[contenteditable=true] ol, *[contenteditable=""] ol *, *[contenteditable=true] ol *');
    return false;
  }

  /**
   *  WysiHat.Commands#toggleUnorderedList() -> undefined
   *
   *  Formats current selection as an unordered list. If the selection is empty
   *  a new list is inserted.
   *
   *  If the selection is already a unordered list, the entire list
   *  will be toggled. However, toggling the last item of the list
   *  will only affect that item, not the entire list.
  **/
  function toggleUnorderedList() {
    var selection, node;

    selection = window.getSelection();
    node      = selection.getNode();

    if (this.unorderedListSelected() && !node.is("ul li:last-child, ul li:last-child *")) {
      selection.selectNode(node.parent("ul"));
    } else if (this.orderedListSelected()) {
      // Toggle list type
      selection.selectNode(node.parent("ol"));
    }

    this.execCommand('insertunorderedlist', false, null);
  }

  /**
   *  WysiHat.Commands#insertUnorderedList() -> undefined
   *
   *  Alias for WysiHat.Commands#toggleUnorderedList()
  **/
  function insertUnorderedList() {
    this.toggleUnorderedList();
  }

  /**
   *  WysiHat.Commands#unorderedListSelected() -> boolean
   *
   *  Check if current selection is within an unordered list.
  **/
  function unorderedListSelected() {
    var element = window.getSelection().getNode();
    if (element) return element.is('*[contenteditable=""] ul, *[contenteditable=true] ul, *[contenteditable=""] ul *, *[contenteditable=true] ul *');
    return false;
  }

  /**
   *  WysiHat.Commands#insertImage(url) -> undefined
   *
   *  - url (String): value for src
   *  Insert an image at the insertion point with the given url.
  **/
  function insertImage(url) {
    this.execCommand('insertImage', false, url);
  }

  /**
   *  WysiHat.Commands#insertHTML(html) -> undefined
   *
   *  - html (String): HTML or plain text
   *  Insert HTML at the insertion point.
  **/
  function insertHTML(html) {
    if ($.browser.msie) {
      var range = window.document.selection.createRange();
      range.pasteHTML(html);
      range.collapse(false);
      range.select();
    } else {
      this.execCommand('insertHTML', false, html);
    }
  }

  /**
   *  WysiHat.Commands#execCommand(command[, ui = false][, value = null]) -> undefined
   *  - command (String): Command to execute
   *  - ui (Boolean): Boolean flag for showing UI. Currenty this not
   *    implemented by any browser. Just use false.
   *  - value (String): Value to pass to command
   *
   *  A simple delegation method to the documents execCommand method.
  **/
  function execCommand(command, ui, value) {
    var handler = this.commands[command];
    if (handler) {
      handler.bind(this)(value);
    } else {
      try {
        window.document.execCommand(command, ui, value);
      } catch(e) { return null; }
    }

    $(document.activeElement).trigger("field:change");
  }

  /**
   *  WysiHat.Commands#queryCommandState(state) -> Boolean
   *  - state (String): bold, italic, underline, etc
   *
   *  A delegation method to the document's queryCommandState method.
   *
   *  Custom states handlers can be added to the queryCommands hash,
   *  which will be checked before calling the native queryCommandState
   *  command.
   *
   *  editor.queryCommands.set("link", editor.linkSelected);
  **/
  function queryCommandState(state) {
    var handler = this.queryCommands[state];
    if (handler) {
      return handler();
    } else {
      try {
        return window.document.queryCommandState(state);
      } catch(e) { return null; }
    }
  }

  /**
   *  WysiHat.Commands#getSelectedStyles() -> Hash
   *
   *  Fetches the styles (from the styleSelectors hash) from the current
   *  selection and returns it as a hash
  **/
  function getSelectedStyles() {
    var styles = {};
    var editor = this;
    editor.styleSelectors.each(function(style){
      var node = editor.selection.getNode();
      styles[style.first()] = $(node).css(style.last());
    });
    return styles;
  }

  return {
     boldSelection:            boldSelection,
     boldSelected:             boldSelected,
     underlineSelection:       underlineSelection,
     underlineSelected:        underlineSelected,
     italicSelection:          italicSelection,
     italicSelected:           italicSelected,
     strikethroughSelection:   strikethroughSelection,
     indentSelection:          indentSelection,
     outdentSelection:         outdentSelection,
     toggleIndentation:        toggleIndentation,
     indentSelected:           indentSelected,
     fontSelection:            fontSelection,
     fontSizeSelection:        fontSizeSelection,
     colorSelection:           colorSelection,
     backgroundColorSelection: backgroundColorSelection,
     alignSelection:           alignSelection,
     alignSelected:            alignSelected,
     linkSelection:            linkSelection,
     unlinkSelection:          unlinkSelection,
     linkSelected:             linkSelected,
     formatblockSelection:     formatblockSelection,
     toggleOrderedList:        toggleOrderedList,
     insertOrderedList:        insertOrderedList,
     orderedListSelected:      orderedListSelected,
     toggleUnorderedList:      toggleUnorderedList,
     insertUnorderedList:      insertUnorderedList,
     unorderedListSelected:    unorderedListSelected,
     insertImage:              insertImage,
     insertHTML:               insertHTML,
     execCommand:              execCommand,
     queryCommandState:        queryCommandState,
     getSelectedStyles:        getSelectedStyles,

    commands: {
    },

    queryCommands: {
      link:          linkSelected,
      orderedlist:   orderedListSelected,
      unorderedlist: unorderedListSelected
    },

    styleSelectors: {
      fontname:    'fontFamily',
      fontsize:    'fontSize',
      forecolor:   'color',
      hilitecolor: 'backgroundColor',
      backcolor:   'backgroundColor'
    }
  };
})(window);
(function() {
  function cloneWithAllowedAttributes(element, allowedAttributes) {
    var length = allowedAttributes.length, i;
    var result = $('<' + element.tagName.toLowerCase() + '></' + element.tagName.toLowerCase() + '>')
    element = $(element);

    for (i = 0; i < allowedAttributes.length; i++) {
      attribute = allowedAttributes[i];
      if (element.attr(attribute)) {
        result.attr(attribute, element.attr(attribute));
      }
    }

    return result;
  }

  function withEachChildNodeOf(element, callback) {
    var nodes = $(element).children;
    var length = nodes.length, i;
    for (i = 0; i < length; i++) callback(nodes[i]);
  }

  function sanitizeNode(node, tagsToRemove, tagsToAllow, tagsToSkip) {
    var parentNode = node.parentNode;

    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        var tagName = node.tagName.toLowerCase();

        if (tagsToSkip) {
          var newNode = node.cloneNode(false);
          withEachChildNodeOf(node, function(childNode) {
            newNode.appendChild(childNode);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
          parentNode.insertBefore(newNode, node);

        } else if (tagName in tagsToAllow) {
          var newNode = cloneWithAllowedAttributes(node, tagsToAllow[tagName]);
          withEachChildNodeOf(node, function(childNode) {
            newNode.appendChild(childNode);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
          parentNode.insertBefore(newNode, node);

        } else if (!(tagName in tagsToRemove)) {
          withEachChildNodeOf(node, function(childNode) {
            parentNode.insertBefore(childNode, node);
            sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
          });
        }

      case Node.COMMENT_NODE:
        parentNode.removeChild(node);
    }
  }

  jQuery.fn.sanitizeContents = function(options) {
    var element = $(this);
    var tagsToRemove = {};
    $.each((options.remove || "").split(","), function(tagName) {
      tagsToRemove[$.trim(tagName)] = true;
    });

    var tagsToAllow = {};
    $.each((options.allow || "").split(","), function(selector) {
      var parts = $.trim(selector).split(/[\[\]]/);
      var tagName = parts[0];
      var allowedAttributes = $.grep(parts.slice(1), function(n, i) {
        return /./.test(n);
      });
      tagsToAllow[tagName] = allowedAttributes;
    });

    var tagsToSkip = options.skip;

    withEachChildNodeOf(element, function(childNode) {
      sanitizeNode(childNode, tagsToRemove, tagsToAllow, tagsToSkip);
    });

    return element;
  }
})();
(function() {
  function onReadyStateComplete(document, callback) {

    function checkReadyState() {
      if (document.readyState === 'complete') {
        // TODO: the prototype code checked to see if the event exists before removing it.
        $(document).unbind('readystatechange', checkReadyState);
        callback();
        return true;
      } else {
        return false;
      }
    }

    $(document).bind('readystatechange', checkReadyState);
    checkReadyState();
  }

  function observeFrameContentLoaded(element) {
    element = $(element);
    var bare = element.get(0);

    var loaded, contentLoadedHandler;

    loaded = false;
    function fireFrameLoaded() {
      if (loaded) { return };

      loaded = true;
      if (contentLoadedHandler) { contentLoadedHandler.stop(); }
      element.trigger('frame:loaded');
    }

    if (window.addEventListener) {
      contentLoadedHandler = $(document).bind("DOMFrameContentLoaded", function(event) {
        if (element == $(this))
          fireFrameLoaded();
      });
    }

    element.load(function() {
      var frameDocument;
      if (typeof element.contentDocument !== 'undefined') {
        frameDocument = element.contentDocument;
      } else if (typeof element.contentWindow !== 'undefined' && typeof element.contentWindow.document !== 'undefined') {
        frameDocument = element.contentWindow.document;
      }

      onReadyStateComplete(frameDocument, fireFrameLoaded);
    });

    return element;
  }

  function onFrameLoaded(element, callback) {
    element.bind('frame:loaded', callback);
    element.observeFrameContentLoaded();
  }

  jQuery.fn.observeFrameContentLoaded = observeFrameContentLoaded;
  jQuery.fn.onFrameLoaded = onFrameLoaded;
})();
$(document).ready(function() {
  var doc = $(document);
  if ('selection' in document && 'onselectionchange' in document) {
    var selectionChangeHandler = function() {
      var range   = document.selection.createRange();
      var element = range.parentElement();
      $(element).trigger("selection:change");
    }

    doc.bind("selectionchange", selectionChangeHandler);
  } else {
    var previousRange;

    var selectionChangeHandler = function() {
      var element        = document.activeElement;
      var elementTagName = element.tagName.toLowerCase();

      if (elementTagName == "textarea" || elementTagName == "input") {
        previousRange = null;
        $(element).trigger("selection:change");
      } else {
        var selection = window.getSelection();
        if (selection.rangeCount < 1) { return };

        var range = selection.getRangeAt(0);
        if (range && range.equalRange(previousRange)) {
          return;
        }
        previousRange = range;

        element = range.commonAncestorContainer;
        while (element.nodeType == Node.TEXT_NODE)
          element = element.parentNode;

        $(element).trigger("selection:change");
      }

    };

    doc.mouseup(selectionChangeHandler);
    doc.keyup(selectionChangeHandler);
  }
});
WysiHat.Formatting = (function() {
  var ACCUMULATING_LINE      = {};
  var EXPECTING_LIST_ITEM    = {};
  var ACCUMULATING_LIST_ITEM = {};

  return {
    getBrowserMarkupFrom: function(applicationMarkup) {
      var container = $("<div>" + applicationMarkup + "</div>");

      function spanify(element, style) {
        $(element).replaceWith(
          '<span style="' + style +
          '" class="Apple-style-span">' +
          element.innerHTML + '</span>'
        );
      }

      function convertStrongsToSpans() {
        container.find("strong").each(function(index, element) {
          spanify(element, "font-weight: bold");
        });
      }

      function convertEmsToSpans() {
        container.find("em").each(function(index, element) {
          spanify(element, "font-style: italic");
        });
      }

      function convertDivsToParagraphs() {
        container.find("div").each(function(index, element) {
          $(element).replaceWith("<p>" + element.innerHTML + "</p>");
        });
      }

      if ($.browser.webkit || $.browser.mozilla) {
        convertStrongsToSpans();
        convertEmsToSpans();
      } else if ($.browser.msie || $.browser.opera) {
        convertDivsToParagraphs();
      }

      return container.html();
    },

    getApplicationMarkupFrom: function($element) {
      var element = $element.get(0);
      var mode = ACCUMULATING_LINE, result, container, line, lineContainer, previousAccumulation;

      function walk(nodes) {
        var length = nodes.length, node, tagName, i;

        for (i = 0; i < length; i++) {
          node = nodes[i];

          if (node.nodeType == 1) {
            tagName = node.tagName.toLowerCase();
            open(tagName, node);
            walk(node.childNodes);
            close(tagName);

          } else if (node.nodeType == 3) {
            read(node.nodeValue);
          }
        }
      }

      function open(tagName, node) {
        if (mode == ACCUMULATING_LINE) {
          // if it's a block-level element and the line buffer is full, flush it
          if (isBlockElement(tagName)) {
            if (isEmptyParagraph(node)) {
              accumulate($("<br />").get(0));
            }

            flush();

            // if it's a ul or ol, switch to expecting-list-item mode
            if (isListElement(tagName)) {
              container = insertList(tagName);
              mode = EXPECTING_LIST_ITEM;
            }

          } else if (isLineBreak(tagName)) {
            // if it's a br, and the previous accumulation was a br,
            // remove the previous accumulation and flush
            if (isLineBreak(getPreviouslyAccumulatedTagName())) {
              previousAccumulation.parentNode.removeChild(previousAccumulation);
              flush();
            }

            // accumulate the br
            accumulate(node.cloneNode(false));

            // if it's the first br in a line, flush
            if (!previousAccumulation.previousNode) flush();

          } else {
            accumulateInlineElement(tagName, node);
          }

        } else if (mode == EXPECTING_LIST_ITEM) {
          if (isListItemElement(tagName)) {
            mode = ACCUMULATING_LIST_ITEM;
          }

        } else if (mode == ACCUMULATING_LIST_ITEM) {
          if (isLineBreak(tagName)) {
            accumulate(node.cloneNode(false));

          } else if (!isBlockElement(tagName)) {
            accumulateInlineElement(tagName, node);
          }
        }
      }

      function close(tagName) {
        if (mode == ACCUMULATING_LINE) {
          if (isLineElement(tagName)) {
            flush();
          }

          if (line != lineContainer) {
            lineContainer = lineContainer.parentNode;
          }

        } else if (mode == EXPECTING_LIST_ITEM) {
          if (isListElement(tagName)) {
            container = result;
            mode = ACCUMULATING_LINE;
          }

        } else if (mode == ACCUMULATING_LIST_ITEM) {
          if (isListItemElement(tagName)) {
            flush();
            mode = EXPECTING_LIST_ITEM;
          }

          if (line != lineContainer) {
            lineContainer = lineContainer.parentNode;
          }
        }
      }

      function isBlockElement(tagName) {
        return isLineElement(tagName) || isListElement(tagName);
      }

      function isLineElement(tagName) {
        return tagName == "p" || tagName == "div";
      }

      function isListElement(tagName) {
        return tagName == "ol" || tagName == "ul";
      }

      function isListItemElement(tagName) {
        return tagName == "li";
      }

      function isLineBreak(tagName) {
        return tagName == "br";
      }

      function isEmptyParagraph(node) {
        return node.tagName.toLowerCase() == "p" && node.childNodes.length == 0;
      }

      function read(value) {
        accumulate(document.createTextNode(value));
      }

      function accumulateInlineElement(tagName, node) {
        var element = node.cloneNode(false);

        if (tagName == "span") {
          if ($(node).css('fontWeight') == "bold") {
            element = $("<strong></strong>").get(0);

          } else if ($(node).css('fontStyle') == "italic") {
            element = $("<em></em>").get(0);
          }
        }

        accumulate(element);
        lineContainer = element;
      }

      function accumulate(node) {
        if (mode != EXPECTING_LIST_ITEM) {
          if (!line) line = lineContainer = createLine();
          previousAccumulation = node;
          lineContainer.appendChild(node);
        }
      }

      function getPreviouslyAccumulatedTagName() {
        if (previousAccumulation && previousAccumulation.nodeType == 1) {
          return previousAccumulation.tagName.toLowerCase();
        }
      }

      function flush() {
        if (line && line.childNodes.length) {
          container.appendChild(line);
          line = lineContainer = null;
        }
      }

      function createLine() {
        if (mode == ACCUMULATING_LINE) {
          return $("<div></div>").get(0);
        } else if (mode == ACCUMULATING_LIST_ITEM) {
          return $("<li></li>").get(0);
        }
      }

      function insertList(tagName) {
        var list = $('<' + tagName + '></' + tagName + '>').get(0);
        result.appendChild(list);
        return list;
      }

      result = container = $("<div></div>").get(0);
      walk(element.childNodes);
      flush();
      return result.innerHTML;
    }
  };
})();

/** section: wysihat
 *  class WysiHat.Toolbar
**/

WysiHat.Toolbar = function() {
  var editor;
  var element;

  /**
   *  new WysiHat.Toolbar(ed)
   *  - ed (WysiHat.Editor): the editor object that you want to attach to.
   *
   *  This was renamed from 'editor' in the original wysihat code, since I 
   *  had to add a class level 'editor' object, causing a conflict with the 
   *  names.
   *
   *  Creates a toolbar element above the editor. The WysiHat.Toolbar object
   *  has many helper methods to easily add buttons to the toolbar.
   *
   *  This toolbar class is not required for the Editor object to function.
   *  It is merely a set of helper methods to get you started and to build
   *  on top of. If you are going to use this class in your application,
   *  it is highly recommended that you subclass it and override methods
   *  to add custom functionality.
  **/
  function initialize(ed) {
    editor = ed;
    element = createToolbarElement();
  }

  /**
   *  WysiHat.Toolbar#createToolbarElement() -> Element
   *
   *  Creates a toolbar container element and inserts it right above the
   *  original textarea element. The element is a div with the class
   *  'editor_toolbar'.
   *
   *  You can override this method to customize the element attributes and
   *  insert position. Be sure to return the element after it has been
   *  inserted.
  **/
  function createToolbarElement() {
    var toolbar = $('<div class="editor_toolbar"></div>');
    // editor.before(toolbar);
    if($("#toolbar"))
      $("#toolbar").before(toolbar);
    else
      editor.before(toolbar); // this.editor.insert({before: toolbar});
    return toolbar;
  }

  /**
   *  WysiHat.Toolbar#addButtonSet(set) -> undefined
   *  - set (Array): The set array contains nested arrays that hold the
   *  button options, and handler.
   *
   *  Adds a button set to the toolbar.
  **/
  function addButtonSet(set) {
    $(set).each(function(index, button){
      addButton(button);
    });
  }

  /**
   *  WysiHat.Toolbar#addButton(options[, handler]) -> undefined
   *  - options (Hash): Required options hash
   *  - handler (Function): Function to bind to the button
   *
   *  The options hash accepts two required keys, name and label. The label
   *  value is used as the link's inner text. The name value is set to the
   *  link's class and is used to check the button state. However the name
   *  may be omitted if the name and label are the same. In that case, the
   *  label will be down cased to make the name value. So a "Bold" label
   *  will default to "bold" name.
   *
   *  The second optional handler argument will be used if no handler
   *  function is supplied in the options hash.
   *
   *  toolbar.addButton({
   *    name: 'bold', label: "Bold" }, function(editor) {
   *      editor.boldSelection();
   *  });
   *
   *  Would create a link,
   *  "<a href='#' class='button bold'><span>Bold</span></a>"
  **/
  function addButton(options, handler) {
    if (!options['name']) {
      options['name'] = options['label'].toLowerCase();
    }
    var name = options['name'];

    var button = createButtonElement(element, options);

    var handler = buttonHandler(name, options);
    observeButtonClick(button, handler);

    var handler = buttonStateHandler(name, options);
    observeStateChanges(button, name, handler);
  }

  function addDropdown(options, handler) {
    if (!options['name']) {
      options['name'] = options['label'].toLowerCase();
    }
    var name = options['name'];
    var select = createDropdownElement(element, options);

    var handler = buttonHandler(name, options);
    observeDropdownChange(select, handler);
  }

  function observeDropdownChange(element, handler) {
    $(element).change(function() {
      var selectedValue = $(this).val();
      handler(editor, selectedValue);
      $(document.activeElement).trigger("selection:change");
    });
  }

  /**
   *  WysiHat.Toolbar#createButtonElement(toolbar, options) -> Element
   *  - toolbar (Element): Toolbar element created by createToolbarElement
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Creates individual button elements and inserts them into the toolbar
   *  container. The default elements are 'a' tags with a 'button' class.
   *
   *  You can override this method to customize the element attributes and
   *  insert positions. Be sure to return the element after it has been
   *  inserted.
  **/
  function createButtonElement(toolbar, options) {
    var button = $('<a class="button" href="#"><span>' + options['label'] + '</span></a>');
    button.addClass("button");
    button.addClass(options['name']);
    button.addClass(options['cssClass']);
    toolbar.append(button);

    return button;
  }

  function createDropdownElement(toolbar, options) {
    var optionTemplate = '<option value="KEY">VALUE</option>',
        selectTemplate = '<select>OPTIONS</select>';
        builder = '';
    for (var i = 0; i < options.options.length; i++) {
      var o = options.options[i];
      builder += optionTemplate.replace('KEY', o.val).replace('VALUE', o.label);
    };
    var select = $('<select>' + builder + '</select>');

    if(options["selected"])
      select.val(options["selected"]);

    if(options["class_name"])
      select.addClass(options["class_name"]);

    if(options["image"])
      select.attr("image", options["image"]);

    select.addClass(options['cssClass']);
    toolbar.append(select);
    return select;
  }

  /**
   *  WysiHat.Toolbar#buttonHandler(name, options) -> Function
   *  - name (String): Name of button command: 'bold', 'italic'
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Returns the button handler function to bind to the buttons onclick
   *  event. It checks the options for a 'handler' attribute otherwise it
   *  defaults to a function that calls execCommand with the button name.
  **/
  function buttonHandler(name, options) {
    if (options.handler)
      return options.handler;
    else if (options['handler'])
      return options['handler'];
    else
      return function(editor) { editor.execCommand(name); };
  }

  /**
   *  WysiHat.Toolbar#observeButtonClick(element, handler) -> undefined
   *  - element (Element): Button element
   *  - handler (Function): Handler function to bind to element
   *
   *  Bind handler to elements onclick event.
  **/
  function observeButtonClick(element, handler) {
    $(element).click(function() {
      handler(editor);
      //event.stop();
      $(document.activeElement).trigger("selection:change");
      return false;
    });
  }

  /**
   *  WysiHat.Toolbar#buttonStateHandler(name, options) -> Function
   *  - name (String): Name of button command: 'bold', 'italic'
   *  - options (Hash): Options hash that pass from addButton
   *
   *  Returns the button handler function that checks whether the button
   *  state is on (true) or off (false). It checks the options for a
   *  'query' attribute otherwise it defaults to a function that calls
   *  queryCommandState with the button name.
  **/
  function buttonStateHandler(name, options) {
    if (options.query)
      return options.query;
    else if (options['query'])
      return options['query'];
    else
      return function(editor) { return editor.queryCommandState(name); };
  }

  /**
   *  WysiHat.Toolbar#observeStateChanges(element, name, handler) -> undefined
   *  - element (Element): Button element
   *  - name (String): Button name
   *  - handler (Function): State query function
   *
   *  Determines buttons state by calling the query handler function then
   *  calls updateButtonState.
  **/
  function observeStateChanges(element, name, handler) {
    var previousState;
    editor.bind("selection:change", function() {
      var state = handler(editor);
      if (state != previousState) {
        previousState = state;
        updateButtonState(element, name, state);
      }
    });
  }

  /**
   *  WysiHat.Toolbar#updateButtonState(element, name, state) -> undefined
   *  - element (Element): Button element
   *  - name (String): Button name
   *  - state (Boolean): Whether button state is on/off
   *
   *  If the state is on, it adds a 'selected' class to the button element.
   *  Otherwise it removes the 'selected' class.
   *
   *  You can override this method to change the class name or styles
   *  applied to buttons when their state changes.
  **/
  function updateButtonState(elem, name, state) {
    if (state)
      $(elem).addClass('selected');
    else
      $(elem).removeClass('selected');
  }

  return {
    initialize:           initialize,
    createToolbarElement: createToolbarElement,
    addButtonSet:         addButtonSet,
    addButton:            addButton,
    addDropdown:          addDropdown,
    createButtonElement:  createButtonElement,
    buttonHandler:        buttonHandler,
    observeButtonClick:   observeButtonClick,
    buttonStateHandler:   buttonStateHandler,
    observeStateChanges:  observeStateChanges,
    updateButtonState:    updateButtonState,

  };
};

/**
 * WysiHat.Toolbar.ButtonSets
 *
 *  A namespace for various sets of Toolbar buttons. These sets should be
 *  compatible with WysiHat.Toolbar, and can be added to the toolbar with:
 *  toolbar.addButtonSet(WysiHat.Toolbar.ButtonSets.Basic);
**/
WysiHat.Toolbar.ButtonSets = {};

/**
 * WysiHat.Toolbar.ButtonSets.Basic
 *
 *  A basic set of buttons: bold, underline, and italic. This set is
 *  compatible with WysiHat.Toolbar, and can be added to the toolbar with:
 *  toolbar.addButtonSet(WysiHat.Toolbar.ButtonSets.Basic);
**/
WysiHat.Toolbar.ButtonSets.Basic = [
  { label: "Bold" },
  { label: "Italic" },
  { label: "Underline" }
];

/**
 * WysiHat.Toolbar.ButtonSets.Standard
 * 
 * The most common set of buttons that I will be using.
**/
WysiHat.Toolbar.ButtonSets.Standard = [
  { label: "Bold"},
  { label: "Italic"},
  { label: "Underline"},
  { label: "Bullets", handler: function(editor) { return editor.toggleUnorderedList(); } },
  { label: "Numbers", handler: function(editor) { return editor.toggleOrderedList(); } }
];

// Set wysihat as a jQuery plugin
$.fn.wysihat = function(buttons) {
  buttons = typeof(buttons) == 'undefined' ? WysiHat.Toolbar.ButtonSets.Basic : buttons;

  var result;

  this.each(function() {
    var $editor = WysiHat.Editor.attach($(this));
    var toolbar = new WysiHat.Toolbar($editor);
    toolbar.initialize($editor);
    toolbar.addButtonSet(buttons);
    $editor.toolbar = toolbar;
    if (result) result.add($editor); else result = $editor;
  });

  return result;
};

})(jQuery);
