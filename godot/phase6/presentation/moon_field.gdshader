shader_type canvas_item;
// judgment-runtime.js drawJudgmentField(): purple floor glow plus the GIF's crack strip as a
// mirrored 104 x 198 pattern, with the two 42 x 22 safe ellipses cut out (evenodd clip).
uniform vec2 safe_a;
uniform vec2 safe_b;
uniform float strength = 0.14;
uniform float pattern_alpha = 0.78;
uniform float top = 340.0;
uniform float bottom = 512.0;
uniform float cam_x = 0.0;
uniform sampler2D sheet : filter_nearest;
uniform vec2 sheet_size = vec2(7680.0, 1440.0);
uniform vec2 cell = vec2(550.0, 0.0);
varying vec2 world;

void vertex() {
	// The field node sits at the origin of the world node, so local vertices are game-world units.
	world = VERTEX;
}

bool inside(vec2 p, vec2 s) {
	vec2 d = (p - s) / vec2(42.0, 22.0);
	return dot(d, d) <= 1.0;
}

void fragment() {
	if (inside(world, safe_a) || inside(world, safe_b)) discard;
	float u = clamp((world.y - top) / (bottom - top), 0.0, 1.0);
	vec3 glow = u < 0.5 ? mix(vec3(96.0, 22.0, 166.0), vec3(175.0, 36.0, 242.0), u * 2.0) : mix(vec3(175.0, 36.0, 242.0), vec3(69.0, 15.0, 125.0), (u - 0.5) * 2.0);
	vec2 tile = vec2(mod(world.x - cam_x, 104.0), mod(world.y, 198.0));
	vec2 local = vec2(tile.x < 52.0 ? tile.x : 104.0 - tile.x, tile.y < 99.0 ? tile.y : 198.0 - tile.y);
	vec4 crack = texture(sheet, (cell + local * vec2(220.0 / 52.0, 360.0 / 99.0)) / sheet_size);
	float a_glow = strength;
	float a_crack = crack.a * pattern_alpha;
	float a = a_crack + a_glow * (1.0 - a_crack);
	vec3 rgb = (crack.rgb * a_crack + glow / 255.0 * a_glow * (1.0 - a_crack)) / max(a, 0.0001);
	COLOR = vec4(rgb, a);
}
