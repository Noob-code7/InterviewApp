import torch
import torch.nn as nn
from transformers import Wav2Vec2Config, Wav2Vec2Model

class Speech_emotion(nn.Module):
    def __init__(self):
        super(Speech_emotion, self).__init__()
        # Load config without downloading large binary weights (weights are loaded from state_dict)
        config = Wav2Vec2Config.from_pretrained("superb/wav2vec2-base-superb-er")
        self.backbone_model = Wav2Vec2Model(config)
        
        # Dense Layer 1
        self.dense_1 = nn.Linear(self.backbone_model.config.hidden_size, 524)
        self.activation1 = nn.ReLU()
        self.batchnorm1 = nn.BatchNorm1d(524)
        self.dropout_1 = nn.Dropout(0.3)

        # Dense Layer 2
        self.dense_2 = nn.Linear(524, 256)
        self.activation2 = nn.ReLU()
        self.batchnorm2 = nn.BatchNorm1d(256)
        self.dropout_2 = nn.Dropout(0.1)

        # Output Head (8 RAVDESS emotions)
        self.dense_3 = nn.Linear(256, 8)

    def forward(self, x):
        x = self.backbone_model(x)
        hidden_state = x.last_hidden_state
        mean_values = torch.mean(hidden_state, dim=1)
        
        x = self.dense_1(mean_values)
        x = self.batchnorm1(x)
        x = self.activation1(x)
        x = self.dropout_1(x)

        x = self.dense_2(x)
        x = self.batchnorm2(x)
        x = self.activation2(x)
        x = self.dropout_2(x)

        x = self.dense_3(x)
        return x
