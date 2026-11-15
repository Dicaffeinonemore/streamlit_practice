shader_type canvas_item;
render_mode blend_add;
void fragment() {
	float alpha = texture(TEXTURE, UV).a * COLOR.a;
	COLOR = vec4(0.690196, 0.062745, 0.094118, alpha);
}
