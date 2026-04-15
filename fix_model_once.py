import torch

# Load your model
checkpoint = torch.load('lits_tumor_model.pth', map_location='cpu', weights_only=False)

# Remove 'resnet.' prefix from all keys
old_dict = checkpoint['model_state_dict']
new_dict = {}

for key, value in old_dict.items():
    # Remove 'resnet.' prefix if it exists
    if key.startswith('resnet.'):
        new_key = key[7:]  # Remove 'resnet.'
    else:
        new_key = key
    new_dict[new_key] = value

# Save as new file
checkpoint['model_state_dict'] = new_dict
torch.save(checkpoint, 'lits_tumor_model_fixed.pth')

print("✅ Fixed model saved as: lits_tumor_model_fixed.pth")
print(f"Original keys: {len(old_dict)}")
print(f"Fixed keys: {len(new_dict)}")
print("\nExample of fix:")
for old, new in list(zip(old_dict.keys(), new_dict.keys()))[:5]:
    print(f"  {old} -> {new}")