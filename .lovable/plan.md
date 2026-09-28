# Wellbeing check slider polarity

## What will change

- Put **Pain** first and **Stress** second on the Wellbeing Check.
- Display Pain as **None** on the left and **Severe** on the right.
- Display Stress as **Calm** on the left and **Very stressed** on the right.
- Make those two sliders run visually from **green on the left to red on the right**.
- Keep the other four sliders in their current direction: the difficult state on the left and the positive state on the right, running red to green.
- Apply the same presentation wherever the Wellbeing Check appears, including the before-session wizard and the after-session check.

## What will not change

- Existing saved wellbeing scores.
- Frequency recommendations or matching calculations.
- Session history and before/after comparisons.
- Any other session, player, or page behaviour.

## Technical detail

Pain and Stress will be visually reversed without changing their underlying score meanings. This avoids corrupting historical comparisons or changing frequency recommendations. The shared wellbeing scale order will become Pain, Stress, Physical ease, Sleep, Mood, Relaxation.

## Verification

- Confirm labels, thumb colours, and movement direction for all six sliders.
- Confirm Pain and Stress still save the intended values.
- Check both wellbeing screens on desktop and mobile.