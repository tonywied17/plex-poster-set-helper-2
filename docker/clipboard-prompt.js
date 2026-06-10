// Clipboard read permission is required to paste into the terminal. 
// This script prompts the user for permission on first interaction with the page, 
// so that the permission is granted before the user tries to paste.

(function ()
{
  if (!navigator.clipboard || !navigator.clipboard.readText) return
  var asked = false
  function ask()
  {
    if (asked) return
    asked = true
    document.removeEventListener('pointerdown', ask, true)
    document.removeEventListener('mousedown', ask, true)
    document.removeEventListener('keydown', ask, true)
    navigator.clipboard.readText().catch(function () { })
  }
  function arm()
  {
    document.addEventListener('pointerdown', ask, true)
    document.addEventListener('mousedown', ask, true)
    document.addEventListener('keydown', ask, true)
  }
  if (navigator.permissions && navigator.permissions.query)
  {
    navigator.permissions.query({ name: 'clipboard-read' })
      .then(function (s) { if (s.state === 'prompt') arm() })
      .catch(arm)
  } else
  {
    arm()
  }
})()
