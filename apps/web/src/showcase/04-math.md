# Math

KaTeX renders inline and block formulas locally — no server, no network round-trip. Math sits inside prose the same way italic does: a different voice, but the same column.

## Inline

Euler's identity is $e^{i\pi} + 1 = 0$, often called the most beautiful equation in mathematics. The harmonic series $\sum_{n=1}^\infty \frac{1}{n}$ diverges, while $\sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6}$ converges to Basel's constant. The Pythagorean theorem $a^2 + b^2 = c^2$ folds into a single line.

A probability identity, set inline so the prose around it carries the argument: $P(A \mid B) = \frac{P(B \mid A)\, P(A)}{P(B)}$, otherwise known as Bayes' rule.

## Block

The Gaussian integral:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

The Fourier transform pair:

$$
\hat f(\xi) = \int_{-\infty}^{\infty} f(x)\, e^{-2\pi i x \xi}\, dx
\qquad
f(x) = \int_{-\infty}^{\infty} \hat f(\xi)\, e^{2\pi i x \xi}\, d\xi
$$

A small matrix:

$$
A = \begin{pmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{pmatrix}
\qquad
\det A = 0
$$

A piecewise definition:

$$
f(x) =
\begin{cases}
x^2 & \text{if } x \ge 0 \\
-x^2 & \text{otherwise}
\end{cases}
$$

The gradient of a scalar field $\phi$ in three dimensions:

$$
\nabla \phi = \frac{\partial \phi}{\partial x}\hat{\mathbf x}
            + \frac{\partial \phi}{\partial y}\hat{\mathbf y}
            + \frac{\partial \phi}{\partial z}\hat{\mathbf z}
$$

## Aligned equations

Solving a quadratic by completing the square:

$$
\begin{aligned}
ax^2 + bx + c &= 0 \\
x^2 + \frac{b}{a}x &= -\frac{c}{a} \\
\left(x + \frac{b}{2a}\right)^2 &= \frac{b^2 - 4ac}{4a^2} \\
x &= \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
\end{aligned}
$$

## Why local matters

Cloud-rendered math means your notes leak to a server every time you save. KaTeX runs in your browser; every formula on this page was rendered offline, from text you can audit by pressing `E`.
